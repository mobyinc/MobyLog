module.exports = [
  {
    script: './lib/server.js',
    name: 'moby-log-server',
    kill_timeout: 3000,
    exec_mode: 'fork'
  }
]
