# universal-reconnecting-websocket
[![npm version][npmimg]][npm] [![build status][travisimg]][travis] [![coverage][coverallsimg]][coveralls]
[![downloads][downloadsimg]][downloads] [![js-standard-style][standardimg]][standard]

A universal, reconnecting, event based WebSocket abstraction with configurable [backoff][backoff].

## Installation

```console
$ npm install universal-reconnecting-websocket
```

## Usage

```js
const URWS = require("universal-reconnecting-websocket")

const ws = new URWS('wss://example.com')

ws.on('state', console.log) // handler connection state
ws.on('error', console.error) // handle / display errors
ws.on('info', console.debug) // handle non-error status events

ws.on('connect', () => { // Handle the connect event maybe
  ws.send({ // default serializer is JSON
    type: 'handshake',
    foo: 'bar'
  })
})

ws.on('reconnect', () => { // Reconnection handlers can be the same function or a separate function
  ws.send({
    type: 'handshakeWithResume',
    foo: 'bar'
  })
})

ws.on('disconnect', () => {
  console.log('ws fully disconnected')
})

ws.on('message', (ev) => {
  // ev is the raw message event from the websocket
  // ev.data is the raw data payload
  console.log('Received message: ')
  console.log(ev.body.foo.bar) // default de-serializer is JSON
  // deserialized object is found on ev.body
  console.log(ev.data) // raw message data
})

ws.start()

setTimeout(() => {
  ws.stop() // turn off the websocket after a while
}, 10e10)
```

## API

### `URWS = require("universal-reconnecting-websocket")`

Import the URWS class.

### `ws = new URWS(url, [opts])`

Create a URWS instance that will connect to a `ws` or `wss` `url`.  (e.g. [`wss://example.com`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket)) and an `opts` object.

Optional `opts` include:

```js
{
  serializer: JSON.stringify, // Default message serializer
  deserializer: JSON.parse, // Default deserializer
  strategy: 'fibonacci', // default backoff strategy
  protocols: null, // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket
  binaryType: null, // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/binaryType
  strategyOpts: { // backoff options argument
    randomisationFactor: 0.2, // No deep merging is performed.
    initialDelay: 1000, // If you need to change these, you have to repass the whole object
    maxDelay: 20000 // https://github.com/MathieuTurcotte/node-backoff
  },
  transport, // native WebSockets, https://github.com/websockets/ws, or pass in your own
  nodeOpts, // opts for ws in node https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
  failAfter: null, // fail after n failed connection attempts
  name: 'urws-' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1) // name timing events
}
```

### `ws.state`

A getter that returns the current state of the URWS instance.  One of:

- `disconnected`: is disconnected and idle.
- `waiting`: waiting to reconnect within the backoff timing
- `error`: websocket is disconnected and idle due to an unrecoverable error
- `reconnecting`: websocket is attempting to reconnect after being disconnected and `waiting`.
- `connecting`: websocket is attempting to connect for the first time.
- `connected`: websocket is connected and open.

### `ws.binaryType`

A getter/setter that returns the configured `binaryType` option.  If unset, it defaults to whatever the default `binaryType` the WebSocket `transport` defaults to.  If that is unknown, it will return undefined.

When using native WebSockets it will be or can be set to one of:

- 'blob',
- 'arraybuffer'

### `ws.start()`

Start the websocket connection until `ws.stop()` is called, or `opts.failAfter` consecutive reconnection attempts fail.

### `ws.stop()`

Disconnect any active websocket connections, cancel any outstanding reconnection attempts and remove all underlying event listeners from existing WebSockets.

### `ws.send(msg)`

Send a `msg` over a WebSocket.  `opts.serializer` is automatically applied to `msg` and the result is [sent](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send) to the WebSocket server.  If you try to send when not in a `connected` state, the `msg` is discarded and an `error` event is fired.  Any errors while running `opts.serializer` cause the `msg` to be discarded and an `error` event is fired.  In both cases, the `error` will contain the original message as `err.msg`.  Setting `opts.serializer` to `null` or `undefined` disables any automatic attempt to serialize your message.

### Events

The `ws` instance emits the following node style events.  They should all be handled.

#### `ws.on('state', (stateString) => {})`

Listen to the `state` event to get `state` string updates as they are generated.  If `stateString` === `error`, the URWS encountered an unrecoverable error and is not attempting to reconnect any further.

#### `ws.on('error', (err) => {})`

Listen to `error` events to receive various errors that are encountered.  You may wish to display or log these somewhere to provide better visibility of connection state, but some of these may easily be ignored.  If the error originated from an underlying WebSocket event, the event will be available on `err.ev`.

#### `ws.on('info', (ev) => {})`

Listen to the `info` event to get information about clean connection `close` events.  Sometimes websocket servers limit connection time, or need to restart etc.  The `ev` will be an instance of [CloseEvent](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent).

#### `ws.on('connect', (ev) => {})`

Fired on the first successful connection after calling `ws.start()`.  See more on the [`onopen`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/onopen) event.

#### `ws.on('reconnect', (ev) => {})`

Fired on the second and any subsequent successful connection attempts.  Useful for handling resume logic or other mid-session handshake actions. See more on the [`onopen`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/onopen) event.

#### `ws.on('disconnect' () => {})`

Fired after all event listeners have been removed and the websocket has been successfully closed.

#### `ws.on('message', (data) => {})`

Fired whenever the client receives a message from the WebSocket server.  Data will be the contents of the received message.

If the `opts.deserializer` option is set, the `ev.data` field will be deserialized into `ev.body`.  Any errors during that process will prevent the `message` event from firing, and an `error` event will be fired instead, with the original `ev` attached as `err.

With native websockets, this event receives an `ev` will be of type [MessageEvent](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent), but only the data of the message is passed to the event listener.  See more on the [onmessage](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/onmessage) event.  If needed we can expose this, but for now its abstracted away in order to pairty `ws` in the browser.

Setting the `opts.deserializer` option to `null` or `undefined` prevents any automatic attempts at deserializing and the `ev.body` property will be `undefined`.

## License
[MIT](https://tldrlegal.com/license/mit-license)

[stabilityimg]: https://img.shields.io/badge/stability-experimental-orange.svg
[stability]: https://nodejs.org/api/documentation.html#documentation_stability_index
[npmimg]: https://img.shields.io/npm/v/universal-reconnecting-websocket.svg
[npm]: https://npmjs.org/package/universal-reconnecting-websocket
[travisimg]: https://img.shields.io/travis/bcomnes/universal-reconnecting-websocket/master.svg
[travis]: https://travis-ci.org/bcomnes/universal-reconnecting-websocket
[downloadsimg]: https://img.shields.io/npm/dm/universal-reconnecting-websocket.svg
[downloads]: https://npmjs.org/package/universal-reconnecting-websocket
[standardimg]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg
[standard]: https://github.com/feross/standard
[coverallsimg]: https://img.shields.io/coveralls/bcomnes/universal-reconnecting-websocket/master.svg
[coveralls]: https://coveralls.io/github/bcomnes/universal-reconnecting-websocket

[backoff]: https://github.com/MathieuTurcotte/node-backoff#readme
