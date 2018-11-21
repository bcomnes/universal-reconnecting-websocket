const test = require('tape')
const URWS = require('../')

const path = 'ws://localhost:8080'

test('test server is running and connectable', t => {
  const ws = new URWS(path)

  ws.on('error', err => {
    t.fail(err)
    ws.stop()
  })

  ws.on('connect', (ev) => {
    t.pass('connected and received the connect event')
    setTimeout(() => ws.stop(), 500)
  })

  ws.on('disconnect', () => {
    t.pass('disconnected okay')
    t.end()
  })

  ws.start()
})

test('test server can be stopped', t => {
  const ws = new URWS(path)
  ws.on('connect', ev => {
    t.pass('connected and received the connect event')
    ws.send({
      action: 'stop'
    })
    ws.stop()
  })

  ws.on('disconnect', () => {
    t.pass('disconnected okay')
    t.end()
  })

  ws.start()
})
