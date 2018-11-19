/* eslint-env shared-node-browser */
/* global WebSocket MozWebSocket */
function websocketPicker () {
  switch (true) {
    case (typeof WebSocket !== 'undefined'): {
      return WebSocket
    }
    case (typeof MozWebSocket !== 'undefined'): {
      return MozWebSocket
    }
    case (typeof window !== 'undefined'): {
      return window.WebSocket || window.MozWebSocket
    }
    default: {
      return null
    }
  }
}

module.exports = websocketPicker()
