import confetti from 'canvas-confetti';
import { Diner3DScene } from './scene.js';
import { sounds } from './audio.js';
import { MultiplayerClient } from './multiplayer.js';

// SVG wiener icon (authentic sausage, NOT a hot dog with bun!)
const wienerSvg = `<svg class="inline-wiener-icon" viewBox="0 0 40 16" fill="currentColor"><path d="M 5 8 C 5 3.5, 14 4, 20 4 C 26 4, 35 3.5, 35 8 C 35 12.5, 26 12, 20 12 C 14 12, 5 12.5, 5 8 Z"/></svg>`;

class RetroDinerGame {
  constructor() {
    this.scene3d = new Diner3DScene('canvas-container', {
      onGrillClick: (slotIdx) => this.handleGrillSlotClick(slotIdx),
      onBreadClick: () => this.addBun()
    });

    // Game state
    this.level = 1;
    this.score = 0;
    this.money = 0.0;
    this.clientsPerLevel = 3;
    this.clientsServedInLevel = 0;
    this.happyClientsCount = 0;
    this.isPlaying = false;

    // 1 vs 1 Duel Multiplayer State
    this.gameMode = 'solo'; // 'solo' or 'duel'
    this.duelDogs = 0;
    this.opponentDogs = 0;
    this.opponentScore = 0;
    this.opponentName = 'Rival';
    this.duelTimeRemaining = 60;
    this.duelTimerInterval = null;
    this.playerName = 'Chef Retro';

    // Current Customer & Order
    this.currentCustomer = null;
    this.patienceInterval = null;
    this.patienceMax = 25; // seconds
    this.patienceCurrent = 25;

    // Assembly Plate State
    this.currentDog = {
      hasBun: false,
      sausageState: null, // 'raw', 'cooked', 'burned'
      toppings: [] // 'mustard', 'ketchup', 'onion', 'cheese'
    };

    // Grill Slots State
    this.grill = [
      { state: 'empty', progress: 0, timer: null },
      { state: 'empty', progress: 0, timer: null }
    ];

    // Customer Names Pool (1950s)
    this.customerNames = ['Frankie', 'Peggy Sue', 'Johnny', 'Betty', 'Bobby', 'Sandy', 'Ritchie', 'Donna'];

    // High Scores Leaderboard (Default 50s Legends)
    this.leaderboard = JSON.parse(localStorage.getItem('retro_diner_leaderboard')) || [
      { name: 'Elvis P.', score: 850, money: 32.50 },
      { name: 'Marilyn M.', score: 720, money: 26.00 },
      { name: 'James D.', score: 640, money: 21.00 },
      { name: 'Buddy H.', score: 510, money: 16.50 },
      { name: 'Tu Récord', score: 0, money: 0.00 }
    ];

    this.bindUI();
    this.setupMultiplayer();
    this.updateHUD();
    this.checkUrlForRoomCode();
  }

  setupMultiplayer() {
    this.multiplayer = new MultiplayerClient({
      onRoomCreated: (code) => {
        document.getElementById('mp-choice-view').classList.add('hidden');
        document.getElementById('mp-waiting-view').classList.remove('hidden');
        document.getElementById('mp-display-code').textContent = code;
        document.getElementById('lobby-host-name').textContent = this.playerName;
        document.getElementById('lobby-guest-name').textContent = 'Esperando rival...';
        document.getElementById('mp-status-text').textContent = '¡Comparte el código con tu amigo para que se una!';
        this.showToast(`Sala creada: ${code}`);
      },

      onRoomJoined: (data) => {
        this.opponentName = data.opponentName || 'Anfitrión';
        document.getElementById('mp-choice-view').classList.add('hidden');
        document.getElementById('mp-waiting-view').classList.remove('hidden');
        document.getElementById('mp-display-code').textContent = data.roomCode;
        document.getElementById('lobby-host-name').textContent = this.opponentName;
        document.getElementById('lobby-guest-name').textContent = this.playerName;
        document.getElementById('lobby-guest-badge').textContent = 'LISTO';
        document.getElementById('lobby-guest-badge').className = 'badge-ready';
        document.getElementById('mp-status-text').textContent = '¡Conectado! Esperando a que el anfitrión inicie el reto...';
        this.showToast(`¡Conectado al reto de ${this.opponentName}!`);
      },

      onOpponentJoined: (oppName) => {
        this.opponentName = oppName;
        document.getElementById('lobby-guest-name').textContent = oppName;
        document.getElementById('lobby-guest-badge').textContent = 'LISTO';
        document.getElementById('lobby-guest-badge').className = 'badge-ready';
        document.getElementById('mp-status-text').textContent = `¡${oppName} se ha unido al reto!`;
        document.getElementById('btn-start-duel').classList.remove('hidden');
        sounds.playCoin();
        this.showToast(`¡${oppName} se unió! Puedes iniciar el duelo.`);
      },

      onCountdown: (sec) => {
        this.showToast(`¡El duelo comienza en ${sec} segundos! 🔥`);
        sounds.playBell();
      },

      onDuelStart: (duration) => {
        this.startDuelMatch(duration);
      },

      onOpponentProgress: (dogs, score) => {
        this.opponentDogs = dogs;
        this.opponentScore = score;
        document.getElementById('duel-opp-dogs').textContent = dogs;
        this.showToast(`⚡ ¡Tu rival acaba de entregar un perro caliente! (${dogs} perros)`);
        sounds.playSquirt();
      },

      onDuelResults: (data) => {
        this.showDuelResults(data);
      },

      onRematchReady: () => {
        document.getElementById('modal-duel-results').classList.add('hidden');
        this.showToast('¡Revancha aceptada! Comenzando en 3s...');
        this.multiplayer.startDuel();
      },

      onOpponentLeft: (msg) => {
        this.showToast(`⚠️ ${msg}`);
        this.endDuelMatch();
      },

      onError: (msg) => {
        this.showToast(`Error: ${msg}`);
        sounds.playError();
      }
    });
  }

  checkUrlForRoomCode() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      document.getElementById('modal-start').classList.add('hidden');
      document.getElementById('modal-multiplayer-lobby').classList.remove('hidden');
      document.getElementById('mp-join-code').value = room.toUpperCase();
    }
  }

  bindUI() {
    // Start solo game button
    document.getElementById('btn-play-game').addEventListener('click', () => {
      document.getElementById('modal-start').classList.add('hidden');
      sounds.init();
      this.gameMode = 'solo';
      this.startLevel();
    });

    // Sound toggle
    const btnSound = document.getElementById('btn-sound');
    btnSound.addEventListener('click', () => {
      const on = sounds.toggle();
      btnSound.textContent = on ? '🔊' : '🔇';
    });

    // Leaderboard
    document.getElementById('btn-ranking').addEventListener('click', () => this.showLeaderboard());
    document.getElementById('btn-close-ranking').addEventListener('click', () => {
      document.getElementById('modal-leaderboard').classList.add('hidden');
    });

    // Next Level button (solo mode)
    document.getElementById('btn-next-level').addEventListener('click', () => {
      document.getElementById('modal-level-complete').classList.add('hidden');
      this.level++;
      this.clientsPerLevel += 1;
      this.startLevel();
    });

    // Multiplayer Buttons
    document.getElementById('btn-multiplayer').addEventListener('click', async () => {
      document.getElementById('modal-start').classList.add('hidden');
      document.getElementById('modal-multiplayer-lobby').classList.remove('hidden');
      sounds.init();
      try {
        await this.multiplayer.connect();
      } catch {
        this.showToast('Conectando al servidor multijugador...');
      }
    });

    document.getElementById('btn-close-mp').addEventListener('click', () => {
      document.getElementById('modal-multiplayer-lobby').classList.add('hidden');
      document.getElementById('modal-start').classList.remove('hidden');
    });

    document.getElementById('btn-create-room').addEventListener('click', async () => {
      const name = document.getElementById('mp-player-name').value.trim() || 'Chef Retro';
      this.playerName = name;
      try {
        await this.multiplayer.connect();
        this.multiplayer.createRoom(name, 60);
      } catch (e) {
        this.showToast('No se pudo conectar al servidor multijugador');
      }
    });

    document.getElementById('btn-join-room').addEventListener('click', async () => {
      const name = document.getElementById('mp-player-name').value.trim() || 'Cocinero Rival';
      const code = document.getElementById('mp-join-code').value.trim().toUpperCase();
      this.playerName = name;
      if (!code) {
        this.showToast('Por favor escribe un código de sala');
        return;
      }
      try {
        await this.multiplayer.connect();
        this.multiplayer.joinRoom(code, name);
      } catch (e) {
        this.showToast('No se pudo conectar al servidor multijugador');
      }
    });

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = document.getElementById('mp-display-code').textContent;
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      navigator.clipboard.writeText(shareUrl);
      this.showToast('¡Enlace de invitación copiado al portapapeles! 📋');
    });

    document.getElementById('btn-start-duel').addEventListener('click', () => {
      this.multiplayer.startDuel();
    });

    // Duel End Actions
    document.getElementById('btn-duel-rematch').addEventListener('click', () => {
      this.multiplayer.requestRematch();
    });

    document.getElementById('btn-duel-exit').addEventListener('click', () => {
      document.getElementById('modal-duel-results').classList.add('hidden');
      this.endDuelMatch();
    });

    // 1. Grill Slots (Click to put or pick up sausage)
    [0, 1].forEach(slotIdx => {
      const slotEl = document.getElementById(`slot-${slotIdx}`);
      slotEl.addEventListener('click', () => this.handleGrillSlotClick(slotIdx));
    });

    // 2. Panera (Bread Basket)
    document.getElementById('btn-panera').addEventListener('click', () => this.addBun());

    // 3. Plate Actions: Trash and Big Floating Service Bell above customer!
    document.getElementById('btn-trash').addEventListener('click', () => this.trashCurrentDog());
    document.getElementById('btn-serve-top').addEventListener('click', () => this.serveOrder());

    // 4. Visual Dispensers & Bowls
    document.querySelectorAll('.visual-dispenser, .visual-bowl').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const topping = e.currentTarget.dataset.topping;
        this.addTopping(topping);
      });
    });
  }

  // --- 1 VS 1 DUEL MATCH LIFECYCLE ---
  startDuelMatch(duration = 60) {
    this.gameMode = 'duel';
    this.isPlaying = true;
    this.duelDogs = 0;
    this.opponentDogs = 0;
    this.score = 0;
    this.duelTimeRemaining = duration;

    // Close all modals
    document.getElementById('modal-multiplayer-lobby').classList.add('hidden');
    document.getElementById('modal-duel-results').classList.add('hidden');

    // Show Duel Battle HUD
    const battleBar = document.getElementById('duel-battle-bar');
    battleBar.classList.remove('hidden');
    document.getElementById('duel-my-name').textContent = this.playerName;
    document.getElementById('duel-opp-name').textContent = this.opponentName;
    document.getElementById('duel-my-dogs').textContent = '0';
    document.getElementById('duel-opp-dogs').textContent = '0';
    document.getElementById('duel-clock').textContent = `${this.duelTimeRemaining}s`;

    sounds.playWin();
    this.showToast('¡EMPIEZA EL DUELO 1 VS 1! ¡Prepara la mayor cantidad de perros!');

    // Spawn first customer immediately
    this.spawnNextCustomer();

    // Start synchronized 1-second countdown clock
    if (this.duelTimerInterval) clearInterval(this.duelTimerInterval);
    this.duelTimerInterval = setInterval(() => {
      this.duelTimeRemaining--;
      document.getElementById('duel-clock').textContent = `${this.duelTimeRemaining}s`;

      if (this.duelTimeRemaining <= 10 && this.duelTimeRemaining > 0) {
        sounds.playBell();
      }

      if (this.duelTimeRemaining <= 0) {
        clearInterval(this.duelTimerInterval);
        this.isPlaying = false;
        if (this.multiplayer.role === 'host') {
          this.multiplayer.finishDuel();
        }
      }
    }, 1000);
  }

  showDuelResults(data) {
    this.isPlaying = false;
    if (this.duelTimerInterval) clearInterval(this.duelTimerInterval);
    if (this.patienceInterval) clearInterval(this.patienceInterval);

    const isHost = this.multiplayer.role === 'host';
    const myStats = isHost ? data.hostStats : data.guestStats;
    const oppStats = isHost ? data.guestStats : data.hostStats;

    document.getElementById('duel-battle-bar').classList.add('hidden');

    const titleEl = document.getElementById('duel-winner-title');
    const subEl = document.getElementById('duel-winner-subtitle');
    const signEl = document.getElementById('duel-result-sign');
    const youCard = document.querySelector('.versus-you');
    const oppCard = document.querySelector('.versus-opp');

    youCard.classList.remove('winner');
    oppCard.classList.remove('winner');

    const didIWin = (isHost && data.winner === 'host') || (!isHost && data.winner === 'guest');
    const isDraw = data.winner === 'draw';

    if (isDraw) {
      titleEl.textContent = '¡EMPATE!';
      subEl.textContent = '¡Ambos son cocineros de leyenda en el diner!';
      signEl.textContent = '🤝 ¡GRAN COMBATE! 🤝';
      sounds.playWin();
    } else if (didIWin) {
      titleEl.textContent = '¡VICTORIA!';
      subEl.textContent = `¡Has preparado ${myStats.dogs} perros y venciste a ${this.opponentName}!`;
      signEl.textContent = '🏆 ¡ERES EL REY DEL DINER! 🏆';
      youCard.classList.add('winner');
      sounds.playWin();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    } else {
      titleEl.textContent = '¡DERROTA!';
      subEl.textContent = `${this.opponentName} preparó ${oppStats.dogs} perros frente a tus ${myStats.dogs}.`;
      signEl.textContent = '💥 ¡REVANCHA DISPONIBLE! 💥';
      oppCard.classList.add('winner');
      sounds.playError();
    }

    // Set scoreboard cards
    document.getElementById('versus-you-name').textContent = this.playerName;
    document.getElementById('versus-you-dogs').textContent = myStats.dogs;
    document.getElementById('versus-you-score').textContent = myStats.score;

    document.getElementById('versus-opp-name').textContent = this.opponentName;
    document.getElementById('versus-opp-dogs').textContent = oppStats.dogs;
    document.getElementById('versus-opp-score').textContent = oppStats.score;

    document.getElementById('modal-duel-results').classList.remove('hidden');
  }

  endDuelMatch() {
    this.gameMode = 'solo';
    this.isPlaying = false;
    if (this.duelTimerInterval) clearInterval(this.duelTimerInterval);
    if (this.patienceInterval) clearInterval(this.patienceInterval);
    document.getElementById('duel-battle-bar').classList.add('hidden');
    document.getElementById('modal-duel-results').classList.add('hidden');
    document.getElementById('modal-multiplayer-lobby').classList.add('hidden');
    document.getElementById('modal-start').classList.remove('hidden');
    this.clearCurrentDog();
  }

  // --- SOLO LEVEL MODE ---
  startLevel() {
    this.isPlaying = true;
    this.clientsServedInLevel = 0;
    this.updateHUD();
    this.showToast(`¡Comienza el Nivel ${this.level}!`);
    sounds.playBell();
    this.spawnNextCustomer();
  }

  // --- GRILL LOGIC ---
  handleGrillSlotClick(slotIdx) {
    const slot = this.grill[slotIdx];

    if (slot.state === 'empty') {
      slot.state = 'cooking';
      slot.progress = 0;
      this.updateSlotUI(slotIdx);
      sounds.playSizzle();
      this.showToast('🌭 Salchicha asándose en la parrilla');

      slot.timer = setInterval(() => {
        if (!this.isPlaying) return;
        slot.progress += 0.25;

        if (slot.progress >= 9.0) {
          slot.state = 'burned';
          this.updateSlotUI(slotIdx);
        } else if (slot.progress >= 4.0 && slot.state !== 'cooked') {
          slot.state = 'cooked';
          sounds.playSizzle();
          this.updateSlotUI(slotIdx);
        } else {
          this.updateSlotUI(slotIdx);
        }
      }, 250);

    } else if (slot.state === 'cooked' || slot.state === 'cooking' || slot.state === 'burned') {
      clearInterval(slot.timer);
      const pickedState = slot.state === 'cooked' ? 'cooked' : (slot.state === 'burned' ? 'burned' : 'raw');

      if (this.currentDog.hasBun && !this.currentDog.sausageState) {
        this.currentDog.sausageState = pickedState;
        sounds.playSquirt();
        this.scene3d.updateAssemblyPlate(this.currentDog);
        this.updateDogSummary();

        if (pickedState === 'burned') {
          this.showToast('¡Cuidado! Esa salchicha se quemó 🔥');
        } else if (pickedState === 'raw') {
          this.showToast('¡Esa salchicha aún está cruda!');
        } else {
          this.showToast('¡Salchicha dorada colocada en el pan!');
        }
      } else if (!this.currentDog.hasBun) {
        this.showToast('¡Primero toma un pan de la panera!');
        return;
      } else {
        this.showToast('¡Ya tienes una salchicha en el pan!');
        return;
      }

      slot.state = 'empty';
      slot.progress = 0;
      this.updateSlotUI(slotIdx);
    }
  }

  updateSlotUI(slotIdx) {
    const slot = this.grill[slotIdx];
    const slotEl = document.getElementById(`slot-${slotIdx}`);
    const emptyIcon = slotEl.querySelector('.slot-empty-icon');
    const activeCont = slotEl.querySelector('.slot-active');
    const fill = slotEl.querySelector('.cook-fill');
    const badge = slotEl.querySelector('.cook-badge');
    const wienerBody = slotEl.querySelector('.wiener-body');
    const wienerMarks = slotEl.querySelectorAll('.wiener-mark');

    this.scene3d.updateGrillSlot(slotIdx, slot.state);

    if (slot.state === 'empty') {
      emptyIcon.classList.remove('hidden');
      activeCont.classList.add('hidden');
      slotEl.classList.remove('sizzling');
    } else {
      emptyIcon.classList.add('hidden');
      activeCont.classList.remove('hidden');
      slotEl.classList.add('sizzling');

      const pct = Math.min(100, (slot.progress / 4.0) * 100);
      fill.style.width = `${pct}%`;

      if (slot.state === 'burned') {
        fill.style.background = '#111';
        badge.textContent = '¡QUEMADA!';
        badge.style.background = '#ff3333';
        if (wienerBody) wienerBody.setAttribute('fill', '#1a1111');
        wienerMarks.forEach(m => m.setAttribute('stroke', '#000000'));
      } else if (slot.state === 'cooked') {
        fill.style.background = '#2a9d8f';
        badge.textContent = '¡LISTA!';
        badge.style.background = '#2a9d8f';
        if (wienerBody) wienerBody.setAttribute('fill', '#a82015');
        wienerMarks.forEach(m => m.setAttribute('stroke', '#4a140d'));
      } else {
        fill.style.background = '#ff5400';
        badge.textContent = 'Asando...';
        badge.style.background = '#e76f51';
        if (wienerBody) wienerBody.setAttribute('fill', '#ef7a7a');
        wienerMarks.forEach(m => m.setAttribute('stroke', '#c95454'));
      }
    }
  }

  // --- ASSEMBLY PLATE & PANERA LOGIC ---
  addBun() {
    if (this.currentDog.hasBun) {
      this.showToast('¡Ya tienes un pan en tu plato!');
      return;
    }
    this.currentDog.hasBun = true;
    sounds.playSquirt();
    this.scene3d.updateAssemblyPlate(this.currentDog);
    this.updateDogSummary();
    this.showToast('🥖 Pan fresco tomado de la panera');
  }

  addTopping(topping) {
    if (!this.currentDog.hasBun) {
      this.showToast('¡Primero toma un pan de la panera!');
      return;
    }
    if (!this.currentDog.sausageState) {
      this.showToast('¡Primero pon la salchicha cocida en el pan!');
      return;
    }
    if (this.currentDog.toppings.includes(topping)) {
      this.showToast(`¡Ya agregaste ${topping}!`);
      return;
    }

    this.currentDog.toppings.push(topping);
    sounds.playSquirt();
    this.scene3d.updateAssemblyPlate(this.currentDog);
    this.updateDogSummary();
  }

  clearCurrentDog() {
    this.currentDog = { hasBun: false, sausageState: null, toppings: [] };
    this.scene3d.clearAssemblyPlate();
    this.updateDogSummary();
  }

  trashCurrentDog() {
    if (!this.currentDog.hasBun && !this.currentDog.sausageState) return;
    this.clearCurrentDog();
    sounds.playError();
    this.showToast('🗑️ Pedido descartado');
  }

  updateDogSummary() {
    const displayEl = document.getElementById('plate-dog-display');
    const serveBtn = document.getElementById('btn-serve-top');
    const bellLabel = serveBtn.querySelector('.bell-label');

    if (!this.currentDog.hasBun) {
      displayEl.innerHTML = '<div class="empty-plate-hint">Toma un pan de la panera</div>';
      serveBtn.disabled = true;
      bellLabel.textContent = '¡ENTREGAR ORDEN!';
      return;
    }

    let itemsHtml = '<span class="item-badge">🥖 Pan</span>';
    if (this.currentDog.sausageState === 'cooked') {
      itemsHtml += `<span class="item-badge item-sausage">${wienerSvg} Salchicha Dorada</span>`;
    } else if (this.currentDog.sausageState === 'burned') {
      itemsHtml += `<span class="item-badge" style="border-color:#111;color:#444;">${wienerSvg} Salchicha Quemada</span>`;
    } else if (this.currentDog.sausageState === 'raw') {
      itemsHtml += `<span class="item-badge" style="border-color:#fca5a5;color:#ef4444;">${wienerSvg} Salchicha Cruda</span>`;
    }

    this.currentDog.toppings.forEach(top => {
      const labelMap = {
        ketchup: '🥫 Ketchup',
        mustard: '🟡 Mostaza',
        onion: '🧅 Cebolla',
        cheese: '🧀 Queso'
      };
      itemsHtml += `<span class="item-badge item-${top}">${labelMap[top] || top}</span>`;
    });

    displayEl.innerHTML = itemsHtml;

    const isReady = !!this.currentDog.sausageState;
    serveBtn.disabled = !isReady;
    if (isReady && this.currentCustomer) {
      bellLabel.textContent = `¡ENTREGAR A ${this.currentCustomer.name.toUpperCase()}!`;
    } else {
      bellLabel.textContent = '¡ENTREGAR ORDEN!';
    }
  }

  // --- CUSTOMER & ORDERS ---
  spawnNextCustomer() {
    if (this.gameMode === 'solo' && this.clientsServedInLevel >= this.clientsPerLevel) {
      this.completeLevel();
      return;
    }

    const name = this.customerNames[Math.floor(Math.random() * this.customerNames.length)];
    const possibleToppings = ['mustard', 'ketchup', 'onion'];
    if (this.level >= 2 || this.gameMode === 'duel') possibleToppings.push('cheese');

    const numToppings = 1 + Math.floor(Math.random() * (this.gameMode === 'duel' ? 2 : (this.level >= 3 ? 3 : 2)));
    const shuffled = [...possibleToppings].sort(() => 0.5 - Math.random());
    const orderToppings = shuffled.slice(0, numToppings);

    this.currentCustomer = {
      name,
      order: {
        bun: true,
        sausage: 'cooked',
        toppings: orderToppings
      }
    };

    this.scene3d.spawnCustomer('customer_retro');

    const bubble = document.getElementById('order-bubble');
    document.getElementById('customer-name').textContent = name;

    const itemsContainer = document.getElementById('order-items');
    itemsContainer.innerHTML = `
      <span class="item-badge">🥖 Pan</span>
      <span class="item-badge item-sausage">${wienerSvg} Salchicha</span>
    `;

    const labelMap = {
      mustard: '🟡 Mostaza',
      ketchup: '🥫 Ketchup',
      onion: '🧅 Cebolla',
      cheese: '🧀 Queso'
    };

    orderToppings.forEach(top => {
      itemsContainer.innerHTML += `<span class="item-badge item-${top}">${labelMap[top]}</span>`;
    });

    bubble.classList.remove('hidden');
    this.updateDogSummary();

    this.patienceMax = Math.max(12, 26 - this.level * 2);
    this.patienceCurrent = this.patienceMax;
    this.updatePatienceBar();

    if (this.patienceInterval) clearInterval(this.patienceInterval);
    this.patienceInterval = setInterval(() => {
      if (!this.isPlaying) return;
      this.patienceCurrent -= 0.5;
      this.updatePatienceBar();

      if (this.patienceCurrent <= 0) {
        this.customerTimeout();
      }
    }, 500);
  }

  updatePatienceBar() {
    const bar = document.getElementById('patience-bar');
    const pct = Math.max(0, (this.patienceCurrent / this.patienceMax) * 100);
    bar.style.width = `${pct}%`;

    if (pct > 50) {
      bar.style.backgroundColor = '#2a9d8f';
    } else if (pct > 25) {
      bar.style.backgroundColor = '#f4a261';
    } else {
      bar.style.backgroundColor = '#e76f51';
    }
  }

  customerTimeout() {
    clearInterval(this.patienceInterval);
    sounds.playError();
    this.showToast(`¡${this.currentCustomer.name} se marchó enojado! 😡`);
    document.getElementById('order-bubble').classList.add('hidden');
    this.scene3d.customerLeave(false);

    if (this.gameMode === 'solo') {
      this.clientsServedInLevel++;
    }

    setTimeout(() => {
      if (this.isPlaying) this.spawnNextCustomer();
    }, 1800);
  }

  serveOrder() {
    if (!this.currentCustomer) return;
    clearInterval(this.patienceInterval);

    const order = this.currentCustomer.order;
    const isBunOk = this.currentDog.hasBun === order.bun;
    const isSausageOk = this.currentDog.sausageState === order.sausage;
    const hasAllReq = order.toppings.every(t => this.currentDog.toppings.includes(t));
    const hasNoExtra = this.currentDog.toppings.every(t => order.toppings.includes(t));
    const isOrderPerfect = isBunOk && isSausageOk && hasAllReq && hasNoExtra;

    if (isOrderPerfect) {
      const patiencePct = this.patienceCurrent / this.patienceMax;
      const basePoints = 100;
      const speedBonus = Math.round(patiencePct * 50);
      const totalPoints = basePoints + speedBonus;
      const tip = (1.50 + patiencePct * 3.50);

      this.score += totalPoints;
      this.money += tip;
      this.happyClientsCount++;

      // In Duel Mode: update duel hot dog counter and notify opponent via WebSockets!
      if (this.gameMode === 'duel') {
        this.duelDogs++;
        document.getElementById('duel-my-dogs').textContent = this.duelDogs;
        this.multiplayer.sendProgress(this.duelDogs, this.score);
      }

      sounds.playCoin();
      this.showToast(`🛎️ ¡Pedido Entregado! +${totalPoints} pts (+$${tip.toFixed(2)} propina 💵)`);
      this.showScorePopup(`+${totalPoints} PTS!`);
      this.scene3d.customerLeave(true);

    } else {
      sounds.playError();
      const penalty = 30;
      this.score = Math.max(0, this.score - penalty);
      this.showToast(`❌ ¡Pedido incorrecto! (-${penalty} pts)`);
      this.scene3d.customerLeave(false);
    }

    document.getElementById('order-bubble').classList.add('hidden');
    this.clearCurrentDog();
    this.updateHUD();

    if (this.gameMode === 'solo') {
      this.clientsServedInLevel++;
    }

    setTimeout(() => {
      if (this.isPlaying) this.spawnNextCustomer();
    }, 1900);
  }

  completeLevel() {
    this.isPlaying = false;
    clearInterval(this.patienceInterval);
    sounds.playWin();

    confetti({
      particleCount: 85,
      spread: 75,
      origin: { y: 0.6 }
    });

    document.getElementById('level-complete-title').textContent = `¡Gran trabajo en el Nivel ${this.level}!`;
    document.getElementById('stat-happy-clients').textContent = `${this.happyClientsCount} clientes`;
    document.getElementById('stat-level-tips').textContent = `$${this.money.toFixed(2)}`;
    document.getElementById('stat-level-score').textContent = `${this.score} pts`;

    document.getElementById('modal-level-complete').classList.remove('hidden');
    this.saveHighScore('Tu Récord', this.score, this.money);
  }

  saveHighScore(playerName, score, money) {
    const userEntry = this.leaderboard.find(e => e.name === playerName);
    if (userEntry) {
      if (score > userEntry.score) {
        userEntry.score = score;
        userEntry.money = money;
      }
    } else {
      this.leaderboard.push({ name: playerName, score, money });
    }
    this.leaderboard.sort((a, b) => b.score - a.score);
    localStorage.setItem('retro_diner_leaderboard', JSON.stringify(this.leaderboard));
  }

  showLeaderboard() {
    const tbody = document.getElementById('leaderboard-rows');
    tbody.innerHTML = '';
    this.leaderboard.forEach((entry, i) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${entry.name}</strong></td>
        <td>${entry.score}</td>
        <td>$${entry.money.toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
    document.getElementById('modal-leaderboard').classList.remove('hidden');
  }

  updateHUD() {
    document.getElementById('level-num').textContent = this.level;
    document.getElementById('score-val').textContent = this.score;
    document.getElementById('money-val').textContent = `$${this.money.toFixed(2)}`;
  }

  showScorePopup(text) {
    const popup = document.createElement('div');
    popup.className = 'floating-score-popup';
    popup.textContent = text;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1800);
  }

  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2400);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new RetroDinerGame();
});
