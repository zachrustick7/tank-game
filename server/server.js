import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss  = new WebSocketServer({ port: PORT });

// rooms: code → { driver: WebSocket | null, gunner: WebSocket | null }
const rooms = new Map();

wss.on('connection', (ws, req) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const code = (url.searchParams.get('room') ?? '').toUpperCase().slice(0, 8);

  if (!code) {
    ws.close(1008, 'Missing room code');
    return;
  }

  // ── Join or create room ──────────────────────────────────────────────────
  let room = rooms.get(code);

  if (!room) {
    room = { driver: ws, gunner: null };
    rooms.set(code, room);
    ws._role = 'driver';
  } else if (!room.gunner) {
    room.gunner  = ws;
    ws._role     = 'gunner';
  } else {
    ws.close(1008, 'Room full');
    return;
  }

  ws._code = code;
  send(ws, { type: 'role', role: ws._role });
  console.log(`[${code}] ${ws._role} connected`);

  // If both seats are now filled, tell both players to start
  if (room.driver && room.gunner) {
    send(room.driver, { type: 'ready' });
    send(room.gunner, { type: 'ready' });
    console.log(`[${code}] session ready`);
  }

  // ── Relay messages to the peer ───────────────────────────────────────────
  ws.on('message', (raw, isBinary) => {
    const peer = getPeer(ws);
    if (peer?.readyState === 1 /* OPEN */) {
      peer.send(raw, { binary: isBinary }); // preserve text/binary framing
    }
  });

  // ── Cleanup on disconnect ────────────────────────────────────────────────
  ws.on('close', () => {
    const r = rooms.get(ws._code);
    if (!r) return;

    console.log(`[${ws._code}] ${ws._role} disconnected`);
    const peer = getPeer(ws);
    if (peer?.readyState === 1) {
      send(peer, { type: 'peer_disconnected' });
    }
    rooms.delete(ws._code);
  });

  ws.on('error', (err) => {
    console.error(`[${ws._code}] ${ws._role} error:`, err.message);
  });
});

function getPeer(ws) {
  const room = rooms.get(ws._code);
  if (!room) return null;
  return ws._role === 'driver' ? room.gunner : room.driver;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

console.log(`Tank game relay server listening on port ${PORT}`);
