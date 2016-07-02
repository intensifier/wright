const path = require('path')
    , utils = require('./utils')

const config = module.exports

Object.assign(config, {
  main        : null,
  reload      : null,
  serve       : null,
  watch       : null,
  host        : 'localhost',
  port        : 3000,
  debugHost   : 'localhost',
  debugPort   : 9222,
  verbose     : false,
  fps         : false
})

config.set = function(options) {
  Object.keys(options).forEach(key => {
    if (config.hasOwnProperty(key))
      config[key] = options[key]
    else
      throw new Error('The key ' + key + ' is not supported')
  })

  config.scripts = utils.Stream()

  if (typeof config.main === 'number')
    config.port = config.main

  if (config.main && config.main.startsWith('http://'))
    config.url = config.main
  else
    config.url = 'http://localhost:' + config.port

  if (config.main && config.main.endsWith('index.html'))
    config.cwd = path.join(process.cwd(), path.dirname(config.main))
  else
    config.cwd = process.cwd()

  if (config.serve)
    config.serve = path.join(config.cwd, config.serve)
  else if (!config.main || !config.main.startsWith('http://'))
    config.serve = config.cwd

  if (!config.watch)
    config.watch = config.serve || config.cwd

  config.chromeUrl = 'http://' + config.debugHost + ':' + config.debugPort
  config.debugProxyPort = config.debugPort - 1
}