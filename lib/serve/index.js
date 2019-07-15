'use strict'

const fs = require('fs')
    , ey = require('ey')
    , js = require('./js')
    , Url = require('url')
    , css = require('./css')
    , log = require('../log')
    , path = require('path')
    , http = require('http')
    , html = require('./html')
    , clone = require('./clone')
    , utils = require('../utils')
    , client = require('./client')
    , config = require('../config')
    , assets = require('../watch/assets')
    , EventEmitter = require('events')
    , httpProxy = require('http-proxy')
    , ServeStatic = require('serve-static')
    , finalhandler = require('finalhandler')

const serve = new EventEmitter()
    , browserClient = fs.readFileSync(path.join(__dirname, '../browser/wright.js'), 'utf8')
    , browserClientMap = fs.readFileSync(path.join(__dirname, '../browser/wright.js.map'), 'utf8')

module.exports = serve
module.exports.ubre = client.ubre

module.exports.start = function() {

  return new Promise((resolve, reject) => {

    const serveOptions = {
      etag        : false,
      redirect    : false,
      fallthrough : Boolean(config.external && !config.clone),
      index       : config.external ? 'index.html' : false,
      setHeaders  : (res, localPath, stat) => {
        assets.watch(localPath)
        res.setHeader('Cache-Control', 'no-store, must-revalidate')
      }
    }

    const externalUrl = config.external && Url.parse(config.external)

    const proxy = config.external && httpProxy.createProxyServer({
      target        : externalUrl.protocol + '//' + externalUrl.host,
      autoRewrite   : true,
      changeOrigin  : true,
      secure        : false
    })

    const corsy = httpProxy.createProxyServer({
      autoRewrite     : true,
      changeOrigin    : true,
      secure          : false,
      followRedirects : true
    })

    proxy && proxy.on('error', error)
    corsy && corsy.on('error', error)

    function error(err, req, res) {
      log.error(err)
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(err)
    }

    corsy.on('proxyRes', (proxyRes) => {
      proxyRes.headers['Access-Control-Allow-Origin'] = '*'
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept'
    })

    const app = ey()

    app.use((req, res, next) => {
      delete req.headers['accept-encoding'] // Avoid gzip so that wright can manipulate requests
      next()
    })

    app.get('/wright.js', (req, res) => res.end(browserClient))
    app.get('/wright.js.map', (req, res) => res.end(browserClientMap))
    app.all(/^\/https?:\/\//i, (req, res) => corsy.web(req, res, { target: req.url.slice(1) }))

    app.get(js.compile)
    app.get(js.rewrite)
    app.get(js.sourceMap)
    app.get(/\.css$/, css)

    app.get(ServeStatic(config.serve, serveOptions))
    app.get(...config.assets.map(p => ServeStatic(p, serveOptions)))
    app.use('/node_modules', ServeStatic(path.join(process.cwd(), 'node_modules'), serveOptions))

    app.get(js.modules)

    config.external && app.get((req, res, next) => {
      req.headers.accept && req.headers.accept.includes('html') && html.hijack(res)
      config.clone && clone(req, res)
      proxy.web(req, res)
    })

    app.get((req, res, next) => {
      if (req.headers.accept && req.headers.accept.indexOf('html') > -1)
        return html.index(res)

      finalhandler(req, res)()
    })

    const server = http.createServer(app)

    server.on('upgrade', (req, socket, head) => {
      if (req.url === '/wright')
        return client.wss.handleUpgrade(req, socket, head, ws => client.wss.emit('connection', ws, req))

      if (config.external)
        return proxy.ws(req, socket, head)

      socket.end()
    })

    server.on('listening', () => {
      html.init()
      resolve()
    })
    server.on('error', reject)
    server.listen(config.port)
  })
  .then(() => config.external && utils.retryConnect(config.external, 5000))
  .then(() => log('Server ' + (config.external ? 'proxying' : 'started') + ' on ' + config.url))
}