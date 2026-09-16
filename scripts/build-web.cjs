'use strict'

const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(directory, args, env = process.env) {
  const result = spawnSync(npm, args, {
    cwd: path.join(root, directory),
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

run('backend-node', ['ci', '--omit=dev'])
run('frontend', ['ci', '--include=dev'])
// This build serves the UI and API together; never embed a local API URL.
run('frontend', ['run', 'build'], { ...process.env, VITE_API_URL: '' })
