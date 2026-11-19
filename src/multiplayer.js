// Client-side WebSocket Multiplayer Client for 1 vs 1 Diner Duels

export class MultiplayerClient {
  constructor(callbacks = {}) {
    this.ws = null;
    this.callbacks = callbacks;
    this.role = null; // 'host' or 'guest'
    this.roomCode = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const host = window.location.hostname || 'localhost';
      const wsUrl = `ws://${host}:3001`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('Multiplayer WebSocket error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        this.connected = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('Invalid message from server:', e);
        }
      };
    });
  }

  handleMessage(data) {
    switch (data.type) {
      case 'room_created':
        this.roomCode = data.roomCode;
        this.role = 'host';
        if (this.callbacks.onRoomCreated) this.callbacks.onRoomCreated(data.roomCode);
        break;

      case 'room_joined':
        this.roomCode = data.roomCode;
        this.role = 'guest';
        if (this.callbacks.onRoomJoined) this.callbacks.onRoomJoined(data);
        break;

      case 'opponent_joined':
        if (this.callbacks.onOpponentJoined) this.callbacks.onOpponentJoined(data.opponentName);
        break;

      case 'duel_countdown':
        if (this.callbacks.onCountdown) this.callbacks.onCountdown(data.seconds);
        break;

      case 'duel_started':
        if (this.callbacks.onDuelStart) this.callbacks.onDuelStart(data.duration);
        break;

      case 'opponent_progress':
        if (this.callbacks.onOpponentProgress) this.callbacks.onOpponentProgress(data.dogs, data.score);
        break;

      case 'duel_results':
        if (this.callbacks.onDuelResults) this.callbacks.onDuelResults(data);
        break;

      case 'rematch_ready':
        if (this.callbacks.onRematchReady) this.callbacks.onRematchReady();
        break;

      case 'opponent_left':
        if (this.callbacks.onOpponentLeft) this.callbacks.onOpponentLeft(data.message);
        break;

      case 'error':
        if (this.callbacks.onError) this.callbacks.onError(data.message);
        break;
    }
  }

  createRoom(playerName, duration = 60) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'create_room',
      name: playerName,
      duration
    }));
  }

  joinRoom(roomCode, playerName) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'join_room',
      roomCode,
      name: playerName
    }));
  }

  startDuel() {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ type: 'start_duel' }));
  }

  sendProgress(dogs, score) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'dog_served',
      dogs,
      score
    }));
  }

  finishDuel() {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ type: 'duel_finish' }));
  }

  requestRematch() {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ type: 'rematch' }));
  }
}
