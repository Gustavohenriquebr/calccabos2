'use strict'

const path = require('node:path')

// Keep the API's relative configuration paths identical to its standalone start.
process.chdir(path.join(__dirname, 'backend-node'))
require('./backend-node/src/app')
