import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 1. Health check route (PROYECTO requirement)
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// 2. Serve static frontend files (compiled dist or public root)
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
app.use(express.static(__dirname));

// Fallback handler for SPA
app.use((req, res) => {
  const distIndex = path.join(distDir, 'index.html');
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// 3. Attach WebSocket server to the same HTTP server
const wss = new WebSocketServer({ server });

// Active rooms map: roomCode -> { host, guest, timer, duration, state, stats: { host: {...}, guest: {...} } }
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DINER-${code}`;
}

function broadcastToRoom(room, data) {
  const msg = JSON.stringify(data);
  if (room.host && room.host.ws.readyState === WebSocket.OPEN) {
    room.host.ws.send(msg);
  }
  if (room.guest && room.guest.ws.readyState === WebSocket.OPEN) {
    room.guest.ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  let currentRoomCode = null;
  let currentRole = null; // 'host' or 'guest'

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'create_room': {
          const roomCode = generateRoomCode();
          currentRoomCode = roomCode;
          currentRole = 'host';

          rooms.set(roomCode, {
            code: roomCode,
            host: { ws, name: data.name || 'Cocinero 1' },
            guest: null,
            duration: data.duration || 60,
            state: 'waiting',
            stats: {
              host: { dogs: 0, score: 0 },
              guest: { dogs: 0, score: 0 }
            }
          });

          ws.send(JSON.stringify({
            type: 'room_created',
            roomCode,
            role: 'host'
          }));
          break;
        }

        case 'join_room': {
          const roomCode = (data.roomCode || '').toUpperCase().trim();
          const room = rooms.get(roomCode);

          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'La sala no existe o ha expirado.' }));
            return;
          }
          if (room.guest) {
            ws.send(JSON.stringify({ type: 'error', message: 'La sala ya está llena.' }));
            return;
          }

          currentRoomCode = roomCode;
          currentRole = 'guest';
          room.guest = { ws, name: data.name || 'Cocinero 2' };
          room.state = 'ready';

          ws.send(JSON.stringify({
            type: 'room_joined',
            roomCode,
            role: 'guest',
            opponentName: room.host.name,
            duration: room.duration
          }));

          room.host.ws.send(JSON.stringify({
            type: 'opponent_joined',
            opponentName: room.guest.name
          }));
          break;
        }

        case 'start_duel': {
          const room = rooms.get(currentRoomCode);
          if (!room || room.state !== 'ready') return;

          room.state = 'playing';
          room.stats = {
            host: { dogs: 0, score: 0 },
            guest: { dogs: 0, score: 0 }
          };

          broadcastToRoom(room, {
            type: 'duel_countdown',
            seconds: 3
          });

          setTimeout(() => {
            if (rooms.get(currentRoomCode) !== room) return;
            broadcastToRoom(room, {
              type: 'duel_started',
              duration: room.duration
            });
          }, 3000);
          break;
        }

        case 'dog_served': {
          const room = rooms.get(currentRoomCode);
          if (!room || room.state !== 'playing') return;

          const myStats = room.stats[currentRole];
          myStats.dogs = data.dogs;
          myStats.score = data.score;

          // Notify opponent of new score in real time
          const opponent = currentRole === 'host' ? room.guest : room.host;
          if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({
              type: 'opponent_progress',
              dogs: myStats.dogs,
              score: myStats.score
            }));
          }
          break;
        }

        case 'duel_finish': {
          const room = rooms.get(currentRoomCode);
          if (!room || room.state === 'finished') return;

          room.state = 'finished';
          const hostStats = room.stats.host;
          const guestStats = room.stats.guest;

          let winner = 'draw';
          if (hostStats.dogs > guestStats.dogs) winner = 'host';
          else if (guestStats.dogs > hostStats.dogs) winner = 'guest';
          else if (hostStats.score > guestStats.score) winner = 'host';
          else if (guestStats.score > hostStats.score) winner = 'guest';

          broadcastToRoom(room, {
            type: 'duel_results',
            winner,
            hostName: room.host.name,
            guestName: room.guest ? room.guest.name : '',
            hostStats,
            guestStats
          });
          break;
        }

        case 'rematch': {
          const room = rooms.get(currentRoomCode);
          if (!room) return;
          room.state = 'ready';
          room.stats = {
            host: { dogs: 0, score: 0 },
            guest: { dogs: 0, score: 0 }
          };

          broadcastToRoom(room, {
            type: 'rematch_ready'
          });
          break;
        }
      }
    } catch (e) {
      console.error('Socket message parse error:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoomCode && rooms.has(currentRoomCode)) {
      const room = rooms.get(currentRoomCode);
      const opponent = currentRole === 'host' ? room.guest : room.host;
      if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
        opponent.ws.send(JSON.stringify({
          type: 'opponent_left',
          message: 'Tu rival se ha desconectado.'
        }));
      }
      rooms.delete(currentRoomCode);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Retro Diner Server corriendo en puerto ${PORT}`);
  console.log(`👉 Visita: http://localhost:${PORT}`);
});
