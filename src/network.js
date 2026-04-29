// ─── Network layer ────────────────────────────────────────────────────────────
//
// Usage:
//   import { net, connect, sendState, sendInput } from './network.js';
//
//   connect('ABCD', 'wss://your-server.com');
//
//   net.on('role',  role  => console.log('I am', role));   // 'driver' | 'gunner'
//   net.on('ready', ()    => console.log('both connected'));
//   net.on('peer_disconnected', () => console.log('other player left'));
//
// Driver each frame:
//   sendState(serializeGameState());
//   const { left, right, fire } = net.gunnerInput;
//
// Gunner each frame:
//   sendInput({ left: ..., right: ..., fire: ... });
//   const snap = net.snapshot;  // null until first state arrives

const _listeners = {};

export const net = {
  role:        null,    // 'driver' | 'gunner' | null (set by server on connect)
  connected:   false,
  ready:       false,   // true once both players are in the room

  // Driver reads these — populated from gunner's sendInput() messages
  gunnerInput: { left: false, right: false, fire: false },

  // Gunner reads this — populated from driver's sendState() messages
  snapshot:    null,

  _ws: null,
};

export function connect(roomCode, wsUrl) {
  const url = `${wsUrl}?room=${roomCode.toUpperCase()}`;
  const ws  = new WebSocket(url);
  net._ws   = ws;

  ws.onopen = () => {
    net.connected = true;
    console.log('[net] connected to relay');
  };

  ws.onmessage = ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    switch (msg.type) {
      case 'role':
        net.role = msg.role;
        _emit('role', msg.role);
        console.log(`[net] assigned role: ${msg.role}`);
        break;

      case 'ready':
        net.ready = true;
        _emit('ready');
        console.log('[net] both players ready');
        break;

      case 'peer_disconnected':
        net.ready = false;
        _emit('peer_disconnected');
        console.log('[net] peer disconnected');
        break;

      case 'input':
        // Driver receives gunner's key state
        if (msg.keys) Object.assign(net.gunnerInput, msg.keys);
        break;

      case 'state':
        // Gunner receives driver's game state snapshot
        net.snapshot = msg.data;
        break;
    }
  };

  ws.onclose = () => {
    net.connected = false;
    net.ready     = false;
    console.log('[net] disconnected from relay');
  };

  ws.onerror = (err) => {
    console.error('[net] WebSocket error', err);
  };
}

// ── Driver → Gunner: full game state snapshot ─────────────────────────────────
// Call once per frame (or at a fixed tick rate like 20hz).
export function sendState(data) {
  _send({ type: 'state', data });
}

// ── Gunner → Driver: key state ────────────────────────────────────────────────
// Call whenever input changes (or every frame — server just relays it).
export function sendInput(keys) {
  _send({ type: 'input', keys });
}

// ── Event emitter ─────────────────────────────────────────────────────────────
export function on(event, fn) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(fn);
}

function _emit(event, data) {
  (_listeners[event] ?? []).forEach(fn => fn(data));
}

function _send(obj) {
  if (net._ws?.readyState === 1 /* OPEN */) {
    net._ws.send(JSON.stringify(obj));
  }
}
