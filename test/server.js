const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message)
    switch (data.action) {
      case 'stop': {
        process.exit()
      }
      default: {
        return console.log(data)
      }
    }
  })

  ws.send('{"something": "foo"}')
})
