'use strict'

require('dotenv').config()

const log = require('./log')
    , serve = require('./serve')
    , watch = require('./watch')
    , config = require('./config')
    , chrome = require('./chrome')
    , firefox = require('./firefox')
    , execute = require('./execute')

let promise

module.exports = function wright(options) {
  log.debugging = Boolean(options.debug)
  log('Starting wright...')

  if (promise)
    return promise

  promise = config.set(options)
  .then(execute)
  .then(serve.start)
  .then(config.browser === 'chrome' && chrome.start)
  .then(config.browser === 'firefox' && firefox)
  .then(watch)
  .catch(err => {
    log.error(err)
    process.exit() // eslint-disable-line
  })

  return promise
}

module.exports.chrome = chrome
module.exports.watch = require('./watch/watch')
