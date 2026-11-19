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

    // Simultaneous Customer Slots: [slot0, slot1]
    this.activeCustomers = [null, null];
    this.patienceIntervals = [null, null];
    this.patienceMax = [25, 25];
    this.patienceCurrent = [25, 25];
    this.maxSimultaneousCustomers = 1; // 1 in Level 1; 2 in Level 2+ / Duel

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
        document.getElementById('mp-choice-view')?.classList.add('hidden');
        document.getElementById('mp-waiting-view')?.classList.remove('hidden');
        const codeEl = document.getElementById('mp-display-code');
        if (codeEl) codeEl.textContent = code;
        const hostEl = document.getElementById('lobby-host-name');
        if (hostEl) hostEl.textContent = this.playerName;
        const guestEl = document.getElementById('lobby-guest-name');
        if (guestEl) guestEl.textContent = 'Esperando rival...';
        const statusEl = document.getElementById('mp-status-text');
        if (statusEl) statusEl.textContent = '¡Comparte el código con tu amigo para que se una!';
        this.showToast(`Sala creada: ${code}`);
      },

      onRoomJoined: (data) => {
        this.opponentName = data.opponentName || 'Anfitrión';
        document.getElementById('mp-choice-view')?.classList.add('hidden');
        document.getElementById('mp-waiting-view')?.classList.remove('hidden');
        const codeEl = document.getElementById('mp-display-code');
        if (codeEl) codeEl.textContent = data.roomCode;
        const hostEl = document.getElementById('lobby-host-name');
        if (hostEl) hostEl.textContent = this.opponentName;
        const guestEl = document.getElementById('lobby-guest-name');
        if (guestEl) guestEl.textContent = this.playerName;
        const badgeEl = document.getElementById('lobby-guest-badge');
        if (badgeEl) {
          badgeEl.textContent = 'LISTO';
          badgeEl.className = 'badge-ready';
        }
        const statusEl = document.getElementById('mp-status-text');
        if (statusEl) statusEl.textContent = '¡Conectado! Esperando a que el anfitrión inicie el reto...';
        this.showToast(`¡Conectado al reto de ${this.opponentName}!`);
      },

      onOpponentJoined: (oppName) => {
        this.opponentName = oppName;
        const guestEl = document.getElementById('lobby-guest-name');
        if (guestEl) guestEl.textContent = oppName;
        const badgeEl = document.getElementById('lobby-guest-badge');
        if (badgeEl) {
          badgeEl.textContent = 'LISTO';
          badgeEl.className = 'badge-ready';
        }
        const statusEl = document.getElementById('mp-status-text');
        if (statusEl) statusEl.textContent = `¡${oppName} se ha unido al reto!`;
        document.getElementById('btn-start-duel')?.classList.remove('hidden');
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
        const oppDogsEl = document.getElementById('duel-opp-dogs');
        if (oppDogsEl) oppDogsEl.textContent = dogs;
        this.showToast(`⚡ ¡Tu rival acaba de entregar un perro caliente! (${dogs} perros)`);
        sounds.playSquirt();
      },

      onDuelResults: (data) => {
        this.showDuelResults(data);
      },

      onRematchReady: () => {
        document.getElementById('modal-duel-results')?.classList.add('hidden');
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
      document.getElementById('modal-start')?.classList.add('hidden');
      document.getElementById('modal-multiplayer-lobby')?.classList.remove('hidden');
      const input = document.getElementById('mp-join-code');
      if (input) input.value = room.toUpperCase();
    }
  }

  bindUI() {
    // Start solo game button
    document.getElementById('btn-play-game')?.addEventListener('click', () => {
      document.getElementById('modal-start')?.classList.add('hidden');
      sounds.init();
      this.gameMode = 'solo';
      this.startLevel();
    });

    // Sound toggle
    const btnSound = document.getElementById('btn-sound');
    btnSound?.addEventListener('click', () => {
      const on = sounds.toggle();
      btnSound.textContent = on ? '🔊' : '🔇';
    });

    // Leaderboard
    document.getElementById('btn-ranking')?.addEventListener('click', () => this.showLeaderboard());
    document.getElementById('btn-close-ranking')?.addEventListener('click', () => {
      document.getElementById('modal-leaderboard')?.classList.add('hidden');
    });

    // Next Level button (solo mode)
    document.getElementById('btn-next-level')?.addEventListener('click', () => {
      document.getElementById('modal-level-complete')?.classList.add('hidden');
      this.level++;
      this.clientsPerLevel += 1;
      this.startLevel();
    });

    // Multiplayer Buttons
    document.getElementById('btn-multiplayer')?.addEventListener('click', async () => {
      document.getElementById('modal-start')?.classList.add('hidden');
      document.getElementById('modal-multiplayer-lobby')?.classList.remove('hidden');
      sounds.init();
      try {
        await this.multiplayer.connect();
      } catch {
        this.showToast('Conectando al servidor multijugador...');
      }
    });

    document.getElementById('btn-close-mp')?.addEventListener('click', () => {
      document.getElementById('modal-multiplayer-lobby')?.classList.add('hidden');
      document.getElementById('modal-start')?.classList.remove('hidden');
    });

    document.getElementById('btn-create-room')?.addEventListener('click', async () => {
      const name = document.getElementById('mp-player-name')?.value.trim() || 'Chef Retro';
      this.playerName = name;
      try {
        await this.multiplayer.connect();
        this.multiplayer.createRoom(name, 60);
      } catch (e) {
        this.showToast('No se pudo conectar al servidor multijugador');
      }
    });

    document.getElementById('btn-join-room')?.addEventListener('click', async () => {
      const name = document.getElementById('mp-player-name')?.value.trim() || 'Cocinero Rival';
      const code = document.getElementById('mp-join-code')?.value.trim().toUpperCase();
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

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      const code = document.getElementById('mp-display-code')?.textContent || '';
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      navigator.clipboard.writeText(shareUrl);
      this.showToast('¡Enlace de invitación copiado al portapapeles! 📋');
    });

    document.getElementById('btn-start-duel')?.addEventListener('click', () => {
      this.multiplayer.startDuel();
    });

    // Duel End Actions
    document.getElementById('btn-duel-rematch')?.addEventListener('click', () => {
      this.multiplayer.requestRematch();
    });

    document.getElementById('btn-duel-exit')?.addEventListener('click', () => {
      document.getElementById('modal-duel-results')?.classList.add('hidden');
      this.endDuelMatch();
    });

    // 1. Grill Slots (Click to put or pick up sausage)
    [0, 1].forEach(slotIdx => {
      const slotEl = document.getElementById(`slot-${slotIdx}`);
      slotEl?.addEventListener('click', () => this.handleGrillSlotClick(slotIdx));
    });

    // 2. Panera (Bread Basket)
    document.getElementById('btn-panera')?.addEventListener('click', () => this.addBun());

    // 3. Plate Trash Action
    document.getElementById('btn-trash')?.addEventListener('click', () => this.trashCurrentDog());

    // 4. Delivery Bell Buttons above Customers (Station 0 and Station 1)
    [0, 1].forEach(slotIdx => {
      const btnServe = document.getElementById(`btn-serve-${slotIdx}`);
      btnServe?.addEventListener('click', () => this.serveOrder(slotIdx));
    });

    // Fallback if old single serve button exists
    document.getElementById('btn-serve-top')?.addEventListener('click', () => {
      // Serve to slot 0 or whichever customer is waiting
      if (this.activeCustomers[0]) this.serveOrder(0);
      else if (this.activeCustomers[1]) this.serveOrder(1);
    });

    // 5. Visual Dispensers & Bowls
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
    this.maxSimultaneousCustomers = 2; // Intense challenge: 2 simultaneous orders!

    // Close all modals
    document.getElementById('modal-multiplayer-lobby')?.classList.add('hidden');
    document.getElementById('modal-duel-results')?.classList.add('hidden');

    // Show Duel Battle HUD
    const battleBar = document.getElementById('duel-battle-bar');
    battleBar?.classList.remove('hidden');
    const myNameEl = document.getElementById('duel-my-name');
    if (myNameEl) myNameEl.textContent = this.playerName;
    const oppNameEl = document.getElementById('duel-opp-name');
    if (oppNameEl) oppNameEl.textContent = this.opponentName;
    const myDogsEl = document.getElementById('duel-my-dogs');
    if (myDogsEl) myDogsEl.textContent = '0';
    const oppDogsEl = document.getElementById('duel-opp-dogs');
    if (oppDogsEl) oppDogsEl.textContent = '0';
    const clockEl = document.getElementById('duel-clock');
    if (clockEl) clockEl.textContent = `${this.duelTimeRemaining}s`;

    sounds.playWin();
    this.showToast('¡EMPIEZA EL DUELO 1 VS 1! ¡Prepara la mayor cantidad de perros!');

    // Start dual rush
    this.spawnCustomerAtSlot(0);
    setTimeout(() => {
      if (this.isPlaying) this.spawnCustomerAtSlot(1);
    }, 1200);

    // Start synchronized 1-second countdown clock
    if (this.duelTimerInterval) clearInterval(this.duelTimerInterval);
    this.duelTimerInterval = setInterval(() => {
      this.duelTimeRemaining--;
      const clock = document.getElementById('duel-clock');
      if (clock) clock.textContent = `${this.duelTimeRemaining}s`;

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
    this.clearAllPatienceIntervals();

    const isHost = this.multiplayer.role === 'host';
    const myStats = isHost ? data.hostStats : data.guestStats;
    const oppStats = isHost ? data.guestStats : data.hostStats;

    document.getElementById('duel-battle-bar')?.classList.add('hidden');

    const titleEl = document.getElementById('duel-winner-title');
    const subEl = document.getElementById('duel-winner-subtitle');
    const signEl = document.getElementById('duel-result-sign');
    const youCard = document.querySelector('.versus-you');
    const oppCard = document.querySelector('.versus-opp');

    youCard?.classList.remove('winner');
    oppCard?.classList.remove('winner');

    const didIWin = (isHost && data.winner === 'host') || (!isHost && data.winner === 'guest');
    const isDraw = data.winner === 'draw';

    if (isDraw) {
      if (titleEl) titleEl.textContent = '¡EMPATE!';
      if (subEl) subEl.textContent = '¡Ambos son cocineros de leyenda en el diner!';
      if (signEl) signEl.textContent = '🤝 ¡GRAN COMBATE! 🤝';
      sounds.playWin();
    } else if (didIWin) {
      if (titleEl) titleEl.textContent = '¡VICTORIA!';
      if (subEl) subEl.textContent = `¡Has preparado ${myStats.dogs} perros y venciste a ${this.opponentName}!`;
      if (signEl) signEl.textContent = '🏆 ¡ERES EL REY DEL DINER! 🏆';
      youCard?.classList.add('winner');
      sounds.playWin();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    } else {
      if (titleEl) titleEl.textContent = '¡DERROTA!';
      if (subEl) subEl.textContent = `${this.opponentName} preparó ${oppStats.dogs} perros frente a tus ${myStats.dogs}.`;
      if (signEl) signEl.textContent = '💥 ¡REVANCHA DISPONIBLE! 💥';
      oppCard?.classList.add('winner');
      sounds.playError();
    }

    // Set scoreboard cards
    const yName = document.getElementById('versus-you-name');
    if (yName) yName.textContent = this.playerName;
    const yDogs = document.getElementById('versus-you-dogs');
    if (yDogs) yDogs.textContent = myStats.dogs;
    const yScore = document.getElementById('versus-you-score');
    if (yScore) yScore.textContent = myStats.score;

    const oName = document.getElementById('versus-opp-name');
    if (oName) oName.textContent = this.opponentName;
    const oDogs = document.getElementById('versus-opp-dogs');
    if (oDogs) oDogs.textContent = oppStats.dogs;
    const oScore = document.getElementById('versus-opp-score');
    if (oScore) oScore.textContent = oppStats.score;

    document.getElementById('modal-duel-results')?.classList.remove('hidden');
  }

  endDuelMatch() {
    this.gameMode = 'solo';
    this.isPlaying = false;
    if (this.duelTimerInterval) clearInterval(this.duelTimerInterval);
    this.clearAllPatienceIntervals();
    document.getElementById('duel-battle-bar')?.classList.add('hidden');
    document.getElementById('modal-duel-results')?.classList.add('hidden');
    document.getElementById('modal-multiplayer-lobby')?.classList.add('hidden');
    document.getElementById('modal-start')?.classList.remove('hidden');
    this.clearCurrentDog();
  }

  clearAllPatienceIntervals() {
    this.patienceIntervals.forEach((interval, idx) => {
      if (interval) clearInterval(interval);
      this.patienceIntervals[idx] = null;
    });
  }

  // --- SOLO LEVEL MODE ---
  startLevel() {
    this.isPlaying = true;
    this.clientsServedInLevel = 0;
    this.clearAllPatienceIntervals();

    // Progression: Level 1 has 1 customer; Level 2+ has 2 customers simultaneously (RUSH HOUR)!
    this.maxSimultaneousCustomers = this.level >= 2 ? 2 : 1;

    // Configure station visibility
    const st0 = document.getElementById('station-0');
    const st1 = document.getElementById('station-1');
    if (st0) st0.classList.remove('hidden');
    if (st1) {
      if (this.maxSimultaneousCustomers >= 2) {
        st1.classList.remove('hidden');
      } else {
        st1.classList.add('hidden');
        document.getElementById('order-bubble-1')?.classList.add('hidden');
      }
    }

    this.updateHUD();
    sounds.playBell();

    if (this.level >= 2) {
      this.showToast(`🔥 ¡Nivel ${this.level}: HORA PICO! Llegan 2 órdenes a la vez 🔥`);
      this.spawnCustomerAtSlot(0);
      setTimeout(() => {
        if (this.isPlaying) this.spawnCustomerAtSlot(1);
      }, 1000);
    } else {
      this.showToast(`¡Comienza el Nivel ${this.level}!`);
      this.spawnCustomerAtSlot(0);
    }
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

        // Stress warning: alarm sound when approaching burn (between 6.5s and 8.9s)
        if (slot.progress >= 6.5 && slot.progress < 9.0 && slot.state === 'cooked') {
          if (Math.round(slot.progress * 4) % 3 === 0) {
            sounds.playBurnAlarm();
          }
        }

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
    if (!slotEl) return;

    const emptyIcon = slotEl.querySelector('.slot-empty-icon');
    const activeCont = slotEl.querySelector('.slot-active');
    const fill = slotEl.querySelector('.cook-fill');
    const badge = slotEl.querySelector('.cook-badge');
    const wienerBody = slotEl.querySelector('.wiener-body');
    const wienerMarks = slotEl.querySelectorAll('.wiener-mark');

    this.scene3d.updateGrillSlot(slotIdx, slot.state);

    if (slot.state === 'empty') {
      emptyIcon?.classList.remove('hidden');
      activeCont?.classList.add('hidden');
      slotEl.classList.remove('sizzling');
    } else {
      emptyIcon?.classList.add('hidden');
      activeCont?.classList.remove('hidden');
      slotEl.classList.add('sizzling');

      const pct = Math.min(100, (slot.progress / 4.0) * 100);
      if (fill) fill.style.width = `${pct}%`;

      if (slot.state === 'burned') {
        if (fill) fill.style.background = '#111';
        if (badge) {
          badge.textContent = '¡QUEMADA!';
          badge.style.background = '#ff3333';
        }
        if (wienerBody) wienerBody.setAttribute('fill', '#1a1111');
        wienerMarks.forEach(m => m.setAttribute('stroke', '#000000'));
      } else if (slot.state === 'cooked') {
        const isNearBurn = slot.progress >= 6.5;
        if (fill) fill.style.background = isNearBurn ? '#e76f51' : '#2a9d8f';
        if (badge) {
          badge.textContent = isNearBurn ? '¡SE QUEMA!' : '¡LISTA!';
          badge.style.background = isNearBurn ? '#d62828' : '#2a9d8f';
        }
        if (wienerBody) wienerBody.setAttribute('fill', '#a82015');
        wienerMarks.forEach(m => m.setAttribute('stroke', '#4a140d'));
      } else {
        if (fill) fill.style.background = '#ff5400';
        if (badge) {
          badge.textContent = 'Asando...';
          badge.style.background = '#e76f51';
        }
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

    if (!this.currentDog.hasBun) {
      if (displayEl) displayEl.innerHTML = '<div class="empty-plate-hint">Toma un pan de la panera</div>';
      // Disable delivery buttons
      [0, 1].forEach(slotIdx => {
        const btn = document.getElementById(`btn-serve-${slotIdx}`);
        const label = document.getElementById(`bell-label-${slotIdx}`);
        if (btn) btn.disabled = true;
        if (label) {
          const cust = this.activeCustomers[slotIdx];
          label.textContent = cust ? `¡Entregar a ${cust.name}!` : '¡Entregar!';
        }
      });
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

    if (displayEl) displayEl.innerHTML = itemsHtml;

    const isReady = !!this.currentDog.sausageState;

    [0, 1].forEach(slotIdx => {
      const btn = document.getElementById(`btn-serve-${slotIdx}`);
      const label = document.getElementById(`bell-label-${slotIdx}`);
      const cust = this.activeCustomers[slotIdx];

      if (btn) btn.disabled = !(isReady && cust);
      if (label) {
        label.textContent = cust ? `¡Entregar a ${cust.name}! 🛎️` : 'Esperando...';
      }
    });
  }

  // --- SIMULTANEOUS CUSTOMERS & ORDERS ---
  spawnCustomerAtSlot(slotIdx) {
    if (this.gameMode === 'solo' && this.clientsServedInLevel >= this.clientsPerLevel) {
      // Check if all active customers are cleared before completing
      if (!this.activeCustomers[0] && !this.activeCustomers[1]) {
        this.completeLevel();
      }
      return;
    }

    const name = this.customerNames[Math.floor(Math.random() * this.customerNames.length)];
    const possibleToppings = ['mustard', 'ketchup', 'onion'];
    if (this.level >= 2 || this.gameMode === 'duel') possibleToppings.push('cheese');

    const maxT = this.gameMode === 'duel' ? 2 : (this.level >= 3 ? 3 : 2);
    const numToppings = 1 + Math.floor(Math.random() * maxT);
    const shuffled = [...possibleToppings].sort(() => 0.5 - Math.random());
    const orderToppings = shuffled.slice(0, numToppings);

    this.activeCustomers[slotIdx] = {
      name,
      order: {
        bun: true,
        sausage: 'cooked',
        toppings: orderToppings
      },
      slotIdx
    };

    // 3D Model in Scene
    this.scene3d.spawnCustomer(slotIdx, 'customer_retro', this.maxSimultaneousCustomers);

    // Show Bubble & fill items
    const bubble = document.getElementById(`order-bubble-${slotIdx}`);
    const nameEl = document.getElementById(`customer-name-${slotIdx}`);
    if (nameEl) nameEl.textContent = name;

    const itemsContainer = document.getElementById(`order-items-${slotIdx}`);
    if (itemsContainer) {
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
    }

    bubble?.classList.remove('hidden');
    bubble?.classList.remove('urgent-shake');
    this.updateDogSummary();
    this.updateRushBanner();

    // Patience timer (shorter in higher levels = more stressful!)
    const basePatience = Math.max(14, 28 - this.level * 2);
    this.patienceMax[slotIdx] = basePatience;
    this.patienceCurrent[slotIdx] = basePatience;
    this.updatePatienceBar(slotIdx);

    if (this.patienceIntervals[slotIdx]) clearInterval(this.patienceIntervals[slotIdx]);

    this.patienceIntervals[slotIdx] = setInterval(() => {
      if (!this.isPlaying) return;
      this.patienceCurrent[slotIdx] -= 0.5;
      this.updatePatienceBar(slotIdx);

      const pct = (this.patienceCurrent[slotIdx] / this.patienceMax[slotIdx]) * 100;

      // High stress ticking clock when patience < 30%
      if (pct < 30 && this.patienceCurrent[slotIdx] > 0) {
        sounds.playUrgentTick();
        bubble?.classList.add('urgent-shake');
      }

      if (this.patienceCurrent[slotIdx] <= 0) {
        this.customerTimeout(slotIdx);
      }
    }, 500);
  }

  updateRushBanner() {
    const banner = document.getElementById('rush-alert-banner');
    if (!banner) return;
    const bothActive = !!(this.activeCustomers[0] && this.activeCustomers[1]);
    if (bothActive) {
      banner.classList.remove('hidden');
      sounds.playRushBell();
    } else {
      banner.classList.add('hidden');
    }
  }

  updatePatienceBar(slotIdx) {
    const bar = document.getElementById(`patience-bar-${slotIdx}`);
    if (!bar) return;
    const pct = Math.max(0, (this.patienceCurrent[slotIdx] / this.patienceMax[slotIdx]) * 100);
    bar.style.width = `${pct}%`;

    if (pct > 50) {
      bar.style.backgroundColor = '#2a9d8f';
    } else if (pct > 25) {
      bar.style.backgroundColor = '#f4a261';
    } else {
      bar.style.backgroundColor = '#e76f51';
    }
  }

  customerTimeout(slotIdx) {
    if (this.patienceIntervals[slotIdx]) clearInterval(this.patienceIntervals[slotIdx]);
    const cust = this.activeCustomers[slotIdx];
    const name = cust ? cust.name : 'El cliente';

    sounds.playError();
    this.showToast(`¡${name} se marchó enojado por la demora! 😡`);

    const bubble = document.getElementById(`order-bubble-${slotIdx}`);
    bubble?.classList.add('hidden');
    bubble?.classList.remove('urgent-shake');

    this.scene3d.customerLeave(slotIdx, false);
    this.activeCustomers[slotIdx] = null;
    this.updateRushBanner();
    this.updateDogSummary();

    if (this.gameMode === 'solo') {
      this.clientsServedInLevel++;
    }

    if (this.gameMode === 'solo' && this.clientsServedInLevel >= this.clientsPerLevel && !this.activeCustomers[0] && !this.activeCustomers[1]) {
      this.completeLevel();
      return;
    }

    setTimeout(() => {
      if (this.isPlaying && (this.gameMode === 'duel' || this.clientsServedInLevel < this.clientsPerLevel)) {
        this.spawnCustomerAtSlot(slotIdx);
      }
    }, 1800);
  }

  serveOrder(slotIdx) {
    const customer = this.activeCustomers[slotIdx];
    if (!customer) return;

    if (this.patienceIntervals[slotIdx]) clearInterval(this.patienceIntervals[slotIdx]);

    const order = customer.order;
    const isBunOk = this.currentDog.hasBun === order.bun;
    const isSausageOk = this.currentDog.sausageState === order.sausage;
    const hasAllReq = order.toppings.every(t => this.currentDog.toppings.includes(t));
    const hasNoExtra = this.currentDog.toppings.every(t => order.toppings.includes(t));
    const isOrderPerfect = isBunOk && isSausageOk && hasAllReq && hasNoExtra;

    if (isOrderPerfect) {
      const patiencePct = this.patienceCurrent[slotIdx] / this.patienceMax[slotIdx];
      const basePoints = 100;
      const speedBonus = Math.round(patiencePct * 60);
      const totalPoints = basePoints + speedBonus;
      const tip = (1.50 + patiencePct * 3.50);

      this.score += totalPoints;
      this.money += tip;
      this.happyClientsCount++;

      // In Duel Mode: update duel hot dog counter and notify opponent via WebSockets!
      if (this.gameMode === 'duel') {
        this.duelDogs++;
        const myDogs = document.getElementById('duel-my-dogs');
        if (myDogs) myDogs.textContent = this.duelDogs;
        this.multiplayer.sendProgress(this.duelDogs, this.score);
      }

      sounds.playCoin();
      this.showToast(`🛎️ ¡Pedido Entregado a ${customer.name}! +${totalPoints} pts (+$${tip.toFixed(2)} propina 💵)`);
      this.showScorePopup(`+${totalPoints} PTS!`);
      this.scene3d.customerLeave(slotIdx, true);

    } else {
      sounds.playError();
      const penalty = 30;
      this.score = Math.max(0, this.score - penalty);
      this.showToast(`❌ ¡Pedido incorrecto para ${customer.name}! (-${penalty} pts)`);
      this.scene3d.customerLeave(slotIdx, false);
    }

    const bubble = document.getElementById(`order-bubble-${slotIdx}`);
    bubble?.classList.add('hidden');
    bubble?.classList.remove('urgent-shake');

    this.activeCustomers[slotIdx] = null;
    this.clearCurrentDog();
    this.updateHUD();
    this.updateRushBanner();

    if (this.gameMode === 'solo') {
      this.clientsServedInLevel++;
    }

    if (this.gameMode === 'solo' && this.clientsServedInLevel >= this.clientsPerLevel && !this.activeCustomers[0] && !this.activeCustomers[1]) {
      this.completeLevel();
      return;
    }

    setTimeout(() => {
      if (this.isPlaying && (this.gameMode === 'duel' || this.clientsServedInLevel < this.clientsPerLevel)) {
        this.spawnCustomerAtSlot(slotIdx);
      }
    }, 1800);
  }

  completeLevel() {
    this.isPlaying = false;
    this.clearAllPatienceIntervals();
    sounds.playWin();

    confetti({
      particleCount: 85,
      spread: 75,
      origin: { y: 0.6 }
    });

    const titleEl = document.getElementById('level-complete-title');
    if (titleEl) titleEl.textContent = `¡Gran trabajo en el Nivel ${this.level}!`;
    const custEl = document.getElementById('stat-happy-clients');
    if (custEl) custEl.textContent = `${this.happyClientsCount} clientes`;
    const tipEl = document.getElementById('stat-level-tips');
    if (tipEl) tipEl.textContent = `$${this.money.toFixed(2)}`;
    const scoreEl = document.getElementById('stat-level-score');
    if (scoreEl) scoreEl.textContent = `${this.score} pts`;

    document.getElementById('modal-level-complete')?.classList.remove('hidden');
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
    if (!tbody) return;
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
    document.getElementById('modal-leaderboard')?.classList.remove('hidden');
  }

  updateHUD() {
    const lvl = document.getElementById('level-num');
    if (lvl) lvl.textContent = this.level;
    const sc = document.getElementById('score-val');
    if (sc) sc.textContent = this.score;
    const mn = document.getElementById('money-val');
    if (mn) mn.textContent = `$${this.money.toFixed(2)}`;
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
    if (!toast) return;
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
