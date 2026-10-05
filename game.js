// Main Game Controller for "Touch Grass: The Brainrot Gauntlet"

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Canvas sizing (virtual internal res 960x540)
    this.width = 960;
    this.height = 540;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // World parameters
    this.worldWidth = 3800;
    this.groundY = 460;
    this.gravity = 0.65;

    // Camera
    this.cameraX = 0;
    this.shake = 0;

    // Game state
    this.state = 'MENU'; // 'MENU', 'PLAYING', 'GAMEOVER', 'VICTORY'
    this.player = null;
    this.hazards = [];
    this.particles = [];
    this.keys = {};

    // Stats & metrics
    this.memesSlapped = 0;
    this.flagsDodged = 0;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.combo = 0;
    this.comboTimer = 0;

    // Grass trigger
    this.grassX = 3450;
    this.grassReached = false;

    // Spawning timers
    this.spawnTimer = 0;

    // Ticker messages
    this.tickerMessages = [
      "🔥 Tip: Press [E] or [Click] to SLAP away toxic memes!",
      "💀 Avoid the giant Red Flags! They obliterate your Aura!",
      "🌱 The Grass Sanctuary awaits at the far right. Reach it to win!",
      "🧢 Cap detected: Deflect incoming spinning caps for bonus Aura!",
      "✨ Maintain high Aura to achieve Sigma / Grass Toucher status."
    ];
    this.currentTicker = 0;

    this.bindEvents();
    this.initUI();
  }

  initUI() {
    this.auraValEl = document.getElementById('aura-val');
    this.auraRankEl = document.getElementById('aura-rank');
    this.progressBarEl = document.getElementById('progress-bar');
    this.memeTickerEl = document.getElementById('meme-ticker');

    this.menuScreen = document.getElementById('screen-menu');
    this.gameOverScreen = document.getElementById('screen-gameover');
    this.winScreen = document.getElementById('screen-win');

    // Rotating ticker
    setInterval(() => {
      this.currentTicker = (this.currentTicker + 1) % this.tickerMessages.length;
      if (this.memeTickerEl) {
        this.memeTickerEl.textContent = this.tickerMessages[this.currentTicker];
      }
    }, 4500);
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'KeyE' || e.code === 'KeyJ') {
        if (this.state === 'PLAYING' && this.player) {
          this.player.triggerSlap();
        }
      }
      if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'ArrowUp') {
        if (this.state === 'PLAYING' && this.player) {
          this.player.jump();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse / Touch slap
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state === 'PLAYING' && this.player) {
        this.player.triggerSlap();
      }
    });

    // Touch controls for mobile / tablet
    const bindTouch = (id, keyCode) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.keys[keyCode] = true;
        if (keyCode === 'Space' && this.player) this.player.jump();
        if (keyCode === 'KeyE' && this.player) this.player.triggerSlap();
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.keys[keyCode] = false;
      });
    };

    bindTouch('btn-left', 'KeyA');
    bindTouch('btn-right', 'KeyD');
    bindTouch('btn-jump', 'Space');
    bindTouch('btn-slap', 'KeyE');

    // UI Buttons
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
    document.getElementById('btn-win-restart').addEventListener('click', () => this.startGame());

    // Sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    soundToggle.addEventListener('click', () => {
      const isMuted = window.sounds.toggleMute();
      soundToggle.textContent = isMuted ? '🔇 Muted' : '🔊 Sound ON';
    });
  }

  startGame() {
    this.state = 'PLAYING';
    this.player = new window.RagdollPlayer(120, this.groundY - 60);
    this.hazards = [];
    this.particles = [];
    this.cameraX = 0;
    this.shake = 0;
    this.memesSlapped = 0;
    this.flagsDodged = 0;
    this.startTime = Date.now();
    this.grassReached = false;
    this.combo = 0;
    this.comboTimer = 0;

    this.menuScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.winScreen.classList.add('hidden');

    window.sounds.init();
    window.sounds.startMusic();
    this.addFloatingText(this.player.x, this.player.y - 40, "ESCAPE THE FEED!", "#00ff88", 22);
  }

  addFloatingText(x, y, text, color = '#fff', size = 18) {
    this.particles.push(new window.Particle(x, y, text, color, (Math.random() - 0.5) * 2, -3, size));
  }

  triggerScreenShake(intensity = 15) {
    this.shake = intensity;
  }

  getAuraRank(aura) {
    if (aura <= 0) return { rank: "COOKED 💀", color: "#ff2a85" };
    if (aura < 1000) return { rank: "NPC 🤖", color: "#aaaaaa" };
    if (aura < 2500) return { rank: "MID 😐", color: "#00f3ff" };
    if (aura < 5000) return { rank: "BASED 😎", color: "#00ff88" };
    if (aura < 9000) return { rank: "SIGMA 🗿", color: "#ffd700" };
    return { rank: "GRASS TOUCHER 🌱✨", color: "#9d4edd" };
  }

  spawnHazard() {
    const pX = this.player.x;
    // Don't spawn hazards right on top of the grass sanctuary
    if (pX > this.grassX - 150) return;

    // Pick type based on current zone
    const types = ['notification', 'popup'];
    if (pX > 800) types.push('redflag', 'cap');
    if (pX > 1800) types.push('redflag', 'redflag', 'popup');

    const type = types[Math.floor(Math.random() * types.length)];

    let spawnX, spawnY, vx, vy;

    if (type === 'redflag') {
      // Drops from the sky slightly ahead of the player
      spawnX = pX + 120 + Math.random() * 200;
      spawnY = -40;
      vx = (Math.random() - 0.5) * 1.5;
      vy = 2.5;
    } else if (type === 'cap') {
      // Fast ricocheting cap
      spawnX = pX + 450;
      spawnY = this.groundY - 120;
      vx = -(5 + Math.random() * 3);
      vy = -2;
    } else if (type === 'notification') {
      spawnX = pX + 400;
      spawnY = this.groundY - 180 + (Math.random() * 100);
      vx = -(3 + Math.random() * 2);
      vy = 0;
      window.sounds.playNotification();
    } else {
      // Meme popup
      spawnX = pX + 380;
      spawnY = this.groundY - 100;
      vx = -(3.5 + Math.random() * 2);
      vy = -2.5;
    }

    this.hazards.push(new window.Hazard(type, spawnX, spawnY, vx, vy));
  }

  update() {
    if (this.state !== 'PLAYING') return;

    this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);

    // Player update
    this.player.update(this.keys, this.gravity, this.groundY);

    // Prevent going backwards past 0
    if (this.player.x < 30) {
      this.player.x = 30;
      this.player.vx = 0;
    }

    // Camera follow (smooth lerp)
    const targetCamX = this.player.x - this.width * 0.35;
    this.cameraX += (targetCamX - this.cameraX) * 0.08;
    this.cameraX = Math.max(0, Math.min(this.worldWidth - this.width, this.cameraX));

    // Screen shake decay
    if (this.shake > 0) this.shake *= 0.88;

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Hazard Spawner
    this.spawnTimer++;
    const spawnRate = this.player.x > 1800 ? 50 : 80;
    if (this.spawnTimer >= spawnRate) {
      this.spawnTimer = 0;
      this.spawnHazard();
    }

    // Slap hitbox check
    const slapHitbox = this.player.getSlapHitbox();

    // Update hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.update(this.groundY);

      // Check if slapped
      if (slapHitbox && h.checkSlap(slapHitbox)) {
        h.slapped = true;
        h.vx = (this.player.facing > 0 ? 1 : -1) * (14 + Math.random() * 6);
        h.vy = -12;
        h.vrot = (Math.random() - 0.5) * 0.6;
        this.memesSlapped++;
        this.combo++;
        this.comboTimer = 90;

        const bonusAura = 400 * this.combo;
        this.player.aura += bonusAura;
        window.sounds.playVineBoom();
        this.triggerScreenShake(12);

        this.addFloatingText(h.x, h.y - 20, `SLAPPED! +${bonusAura} AURA`, "#00ff88", 20);
        if (this.combo > 1) {
          this.addFloatingText(this.player.x, this.player.y - 60, `COMBO x${this.combo}! 🔥`, "#ffd700", 22);
        }
      }

      // Check player collision
      if (h.checkCollision(this.player.x, this.player.y, this.player.width, this.player.height)) {
        // Player got hit!
        this.player.aura -= h.damage;
        this.player.stunned = 35;
        this.player.vx = (this.player.x > h.x ? 1 : -1) * 8;
        this.player.vy = -7;
        this.combo = 0;
        this.triggerScreenShake(20);

        if (h.type === 'redflag') {
          window.sounds.playFlagImpact();
          this.addFloatingText(this.player.x, this.player.y - 30, `RED FLAG! -${h.damage} AURA 🚩`, "#ff2a85", 22);
        } else {
          window.sounds.playVineBoom();
          this.addFloatingText(this.player.x, this.player.y - 30, `COOKED! -${h.damage} AURA 💀`, "#ff2a85", 20);
        }

        // Remove hazard after impact
        this.hazards.splice(i, 1);
        continue;
      }

      // Remove offscreen / dead hazards
      if (h.life <= 0 || h.x < this.cameraX - 200 || h.x > this.cameraX + this.width + 300) {
        if (!h.slapped && h.x < this.player.x - 50) {
          this.flagsDodged++;
          this.player.aura += 100;
          this.addFloatingText(this.player.x, this.player.y - 20, "+100 AURA (DODGE)", "#00f3ff", 14);
        }
        this.hazards.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Check Win Condition (Touch Grass)
    if (this.player.x >= this.grassX && !this.grassReached) {
      this.grassReached = true;
      this.winGame();
    }

    // Check Game Over (Aura <= 0)
    if (this.player.aura <= 0 && this.state === 'PLAYING') {
      this.gameOver();
    }

    // Update HUD
    const rankInfo = this.getAuraRank(this.player.aura);
    this.auraValEl.textContent = `${this.player.aura}`;
    this.auraRankEl.textContent = rankInfo.rank;
    this.auraRankEl.style.color = rankInfo.color;

    const progressPct = Math.min(100, Math.max(0, (this.player.x / this.grassX) * 100));
    this.progressBarEl.style.width = `${progressPct}%`;
  }

  gameOver() {
    this.state = 'GAMEOVER';
    window.sounds.stopMusic();
    window.sounds.playVineBoom();
    this.triggerScreenShake(30);

    document.getElementById('stat-over-slaps').textContent = this.memesSlapped;
    document.getElementById('stat-over-time').textContent = `${this.elapsedTime}s`;
    this.gameOverScreen.classList.remove('hidden');
  }

  winGame() {
    this.state = 'VICTORY';
    window.sounds.stopMusic();
    window.sounds.playGrassTouch();
    this.triggerScreenShake(10);

    // Confetti explosion
    for (let i = 0; i < 40; i++) {
      const emoji = ['🌱', '✨', '🌸', '👑', '🔥'][Math.floor(Math.random() * 5)];
      this.addFloatingText(
        this.player.x + (Math.random() - 0.5) * 120,
        this.player.y - Math.random() * 100,
        emoji,
        '#00ff88',
        28
      );
    }

    document.getElementById('stat-win-aura').textContent = `${this.player.aura}`;
    document.getElementById('stat-win-slaps').textContent = this.memesSlapped;
    document.getElementById('stat-win-time').textContent = `${this.elapsedTime}s`;
    this.winScreen.classList.remove('hidden');
  }

  drawBackground() {
    const ctx = this.ctx;
    const camX = this.cameraX;

    // Background Gradient shifting from Gamer Cave (Dark Purple) -> Sunrise -> Radiant Daylight
    const grad = ctx.createLinearGradient(0, 0, this.width, 0);
    const progress = camX / (this.worldWidth - this.width);

    if (progress < 0.35) {
      grad.addColorStop(0, '#0c0714');
      grad.addColorStop(1, '#1b122c');
    } else if (progress < 0.75) {
      grad.addColorStop(0, '#2d1537');
      grad.addColorStop(1, '#662249');
    } else {
      grad.addColorStop(0, '#4a69bd');
      grad.addColorStop(1, '#78e08f');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(-camX, 0);

    // Background Zone 1: Gamer Cave Wall & LED Strip (0 -> 1000)
    ctx.fillStyle = 'rgba(0, 243, 255, 0.15)';
    ctx.fillRect(50, 80, 800, 6); // RGB LED line
    ctx.fillStyle = '#ff2a85';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('ROOM: DOOMSCROLL DUNGEON', 60, 60);

    // Posters / Monitors
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(150, 120, 140, 90);
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(150, 120, 140, 90);
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.fillText('DISCORD (999+)', 160, 145);

    // Zone 2: Hallway of Red Flags (1000 -> 2200)
    ctx.fillStyle = '#ff2a85';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('HALLWAY: RED FLAG ZONE', 1100, 60);

    // Warning signs on walls
    ctx.fillStyle = 'rgba(255, 0, 50, 0.12)';
    ctx.fillRect(1200, 140, 180, 80);
    ctx.strokeStyle = '#ff0033';
    ctx.strokeRect(1200, 140, 180, 80);
    ctx.fillStyle = '#ff0033';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('⚠️ DANGER: HIGH CRINGE', 1215, 175);

    // Zone 3: Exit Doorway (3100)
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 40;
    ctx.fillRect(3200, 100, 30, this.groundY - 100);
    ctx.shadowBlur = 0;

    // Zone 4: THE GRASS SANCTUARY (3300 -> 3800)
    // Sun rays
    ctx.fillStyle = 'rgba(255, 235, 59, 0.15)';
    ctx.beginPath();
    ctx.moveTo(3500, 0);
    ctx.lineTo(3300, this.groundY);
    ctx.lineTo(3800, this.groundY);
    ctx.closePath();
    ctx.fill();

    // Grass Hill Shimmer
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.ellipse(3550, this.groundY + 20, 260, 70, 0, 0, Math.PI * 2);
    ctx.fill();

    // The Grass Shrine / Beacon
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(3480, this.groundY - 45, 140, 45);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌱 REAL GRASS 🌱', 3550, this.groundY - 55);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('[ STEP HERE TO TOUCH ]', 3550, this.groundY - 20);

    // Ground platform
    ctx.fillStyle = '#11131c';
    ctx.fillRect(0, this.groundY, this.worldWidth, this.height - this.groundY);
    // Neon floor line
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.worldWidth, this.groundY);
    ctx.stroke();

    ctx.restore();
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.ctx.save();
    // Screen shake offset
    if (this.shake > 0) {
      const ox = (Math.random() - 0.5) * this.shake;
      const oy = (Math.random() - 0.5) * this.shake;
      this.ctx.translate(ox, oy);
    }

    // Draw background & world
    this.drawBackground();

    // Draw camera-offset entities
    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);

    // Hazards
    for (const h of this.hazards) {
      h.draw(this.ctx);
    }

    // Player
    if (this.player) {
      this.player.draw(this.ctx);
    }

    // Particles
    for (const p of this.particles) {
      p.draw(this.ctx);
    }

    this.ctx.restore();
    this.ctx.restore();
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
  window.game.loop();
});
