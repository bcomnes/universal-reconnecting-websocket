const EventHandler = require('node-event-handler')
const WebSocket = require('./websocket')
const Nanobus = require('nanobus')
const backoff = require('backoff')
const get = require('lodash.get')

const isBrowser = process.title === 'browser'
const isNative = !!global.WebSocket

class URWS extends Nanobus {
  constructor (url, opts) {
    if (!url) throw new Error('URWS: missing url argument')

    opts = Object.assign({
      serializer: JSON.stringify,
      deserializer: JSON.parse,
      strategy: 'fibonacci',
      protocols: null,
      binaryType: null,
      strategyOpts: {
        randomisationFactor: 0.2,
        initialDelay: 1000,
        maxDelay: 20000
      },
      failAfter: null,
      transport: WebSocket,
      nodeOpts: null,
      name: 'urws-' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
    }, opts)
    super(opts.name)

    this.handler = new EventHandler(this)
    this.url = url
    this.ws = null
    this.protocols = opts.protocols
    this.serializer = opts.serializer
    this.deserializer = opts.deserializer
    this.transport = opts.transport
    this.nodeOpts = opts.nodeOpts

    this._state = 'disconnected'
    this._binaryType = opts.binaryType
    this._firstConnect = null

    this.backoff = backoff[opts.strategy](opts.strategyOpts)
    if (opts.failAfter) this.backoff.failAfter(opts.failAfter)

    this.backoff.on('backoff', (number, delay) => {
      this.state = 'waiting'
    })
    this.backoff.on('ready', (number, delay) => {
      this._reconnect()
    })
    this.backoff.on('fail', () => {
      this._fail(
        new Error(`URWS: failed to connect after ${opts.failAfter} tries`)
      )
    })
  }

  get state () {
    return this._state
  }
  set state (state) {
    this._state = state
    this.emit('state', state)
  }

  get binaryType () {
    if (this._binaryType) return this._binaryType
    if (this.ws && this.ws.binaryType) return this.ws.binaryType
  }
  set binaryType (type) {
    if (['blob', 'arraybuffer'].some(t => t === type)) {
      this._binaryType = type
      if (this.ws) this.ws.binaryType = type
    }
  }

  _error (err) {
    this.emit('error', err)
  }

  _info (info) {
    this.emit('info', info)
  }

  _destroySocket (code, reason) {
    if (!this.ws) return
    this.handler.removeEventListeners(this.ws)
    this.ws.close(code, reason)
    this.ws = null
  }

  _createSocket () {
    if (this.ws) this._destroySocket()
    const WS = this.transport
    this.ws = (isNative && isBrowser) ? new WS(this.url, this.protocols) : new WS(this.url, this.protocols, this.nodeOpts)
    if (this._binaryType) {
      this.ws.binaryType = this._binaryType
    } else {
      this._binaryType = this.ws.binaryType
    }
    this.handler.addEventListeners(this.ws)
  }

  _fail (err) {
    this._destroySocket()
    this.state = 'error'
    this._error(err)
  }

  _reconnect () {
    this.state = 'reconnecting'
    this._destroySocket()
    this._createSocket()
  }

  start () {
    if (!this.transport) {
      return this._fail(
        new Error('URWS: Environment does not support WebSockets')
      )
    }
    this.state = 'connecting'
    this._firstConnect = true
    this._createSocket()
  }

  stop () {
    this.backoff.reset()
    this._destroySocket()
    this.state = 'disconnected'
    this.emit('disconnect')
  }

  send (msg) {
    if (!this.ws) {
      const err = new Error("URWS: Can't send, not connected")
      err.msg = msg
      this.emit('error', err)
    }

    try {
      const payload = this.serializer ? this.serializer(msg) : msg
      this.ws.send(payload)
    } catch (e) {
      e.msg = msg
      this.emit('error', e)
    }
  }

  // Used by dom-event-handler.
  // See https://github.com/bcomnes/dom-event-handler#dom-event-handler
  onclose (ev) {
    if (ev.code >= 400) {
      const err = new Error(
        `URWS: ${ev.code} ${ev.reason ? ev.reason : ''}`
      )
      err.ev = ev
      this._error(err)
    } else {
      this._info(ev)
    }
    this.state = 'disconnected'
    this.backoff.backoff()
  }

  onerror (ev) {
    if (['connecting', 'reconnecting'].some(state => this.state === state)) {
      const backoffNumber = this.backoff.backoffNumber_
      const err = new Error(`URWS: Error durning connection attempt ${backoffNumber}`)
      err.ev = ev
      this._error(err)
    } else {
      // unknown condition
      this._error(new Error(ev))
    }
  }

  onmessage (ev) {
    try {
      const data = get(ev, 'data', ev)
      const body = this.deserializer ? this.deserializer(data) : data
      this.emit('message', body)
    } catch (e) {
      e.ev = ev
      this._error(e)
    }
  }

  onopen (ev) {
    this.state = 'connected'
    if (this._firstConnect) {
      this._firstConnect = false
      this.emit('connect', ev)
    } else {
      this.emit('reconnect', ev)
    }
    this.backoff.reset()
  }
}

module.exports = URWS
