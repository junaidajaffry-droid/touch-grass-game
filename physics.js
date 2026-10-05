// 2D Procedural Ragdoll & Hazard Physics Engine (Self-contained, zero-dependency)

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r = 0) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

class Particle {
  constructor(x, y, text, color, vx = 0, vy = -2, size = 16, life = 60) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.life = life;
    this.maxLife = life;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05; // slight gravity
    this.life--;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class RagdollPlayer {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = 36;
    this.height = 70;
    this.grounded = false;
    this.facing = 1; // 1 = right, -1 = left

    // Ragdoll wobble angles
    this.wobblePhase = 0;
    this.headAngle = 0;
    this.torsoAngle = 0;
    this.legL = 0;
    this.legR = 0;
    this.armL = 0;
    this.armR = 0;

    // Slap Mechanic
    this.isSlapping = false;
    this.slapTimer = 0;
    this.slapAngle = 0;
    this.slapHandRadius = 24;

    // Aura & States
    this.aura = 1000;
    this.cooked = false;
    this.slapCooldown = 0;
    this.stunned = 0;
  }

  jump() {
    if (this.grounded && this.stunned <= 0) {
      this.vy = -13.5;
      this.grounded = false;
      window.sounds.playBoing();
      return true;
    }
    return false;
  }

  triggerSlap() {
    if (this.slapCooldown <= 0 && this.stunned <= 0) {
      this.isSlapping = true;
      this.slapTimer = 16;
      this.slapCooldown = 22;
      this.slapAngle = this.facing > 0 ? -Math.PI * 0.7 : -Math.PI * 0.3;
      window.sounds.playSlap();
      return true;
    }
    return false;
  }

  update(keys, gravity, groundY) {
    if (this.slapCooldown > 0) this.slapCooldown--;
    if (this.stunned > 0) {
      this.stunned--;
      // Spin wildly while stunned
      this.torsoAngle += 0.2 * this.facing;
    }

    // Walking controls
    let moveDir = 0;
    if (this.stunned <= 0) {
      if (keys['KeyA'] || keys['ArrowLeft']) moveDir -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveDir += 1;
    }

    if (moveDir !== 0) {
      this.facing = moveDir;
      this.vx += moveDir * 0.9;
      this.wobblePhase += 0.22;
    } else {
      this.vx *= 0.82;
      this.wobblePhase *= 0.9;
    }

    // Max horizontal speed
    this.vx = Math.max(-6.5, Math.min(6.5, this.vx));

    // Slap animation physics
    if (this.isSlapping) {
      this.slapTimer--;
      // Rapid arc swing
      this.slapAngle += (this.facing > 0 ? 0.35 : -0.35);
      if (this.slapTimer <= 0) {
        this.isSlapping = false;
      }
    }

    // Procedural ragdoll limb wobble
    if (this.grounded) {
      this.legL = Math.sin(this.wobblePhase) * 0.55;
      this.legR = Math.sin(this.wobblePhase + Math.PI) * 0.55;
      this.armL = Math.sin(this.wobblePhase + Math.PI) * 0.45;
      if (!this.isSlapping) {
        this.armR = Math.sin(this.wobblePhase) * 0.45;
      }
      this.torsoAngle = this.vx * 0.04;
      this.headAngle = this.vx * 0.03 + Math.sin(this.wobblePhase * 2) * 0.05;
    } else {
      // In air flailing
      this.legL = Math.sin(Date.now() * 0.015) * 0.4;
      this.legR = -this.legL;
      this.armL = -1.2;
      if (!this.isSlapping) this.armR = -1.2;
      this.torsoAngle = this.vx * 0.06;
      this.headAngle = -0.2;
    }

    // Apply gravity
    this.vy += gravity;
    this.x += this.vx;
    this.y += this.vy;

    // Ground collision
    if (this.y + this.height / 2 >= groundY) {
      this.y = groundY - this.height / 2;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
  }

  // Get bounding box of the active slap hand
  getSlapHitbox() {
    if (!this.isSlapping) return null;
    const handDist = 48;
    const handX = this.x + Math.cos(this.slapAngle) * handDist;
    const handY = this.y - 10 + Math.sin(this.slapAngle) * handDist;
    return {
      x: handX,
      y: handY,
      radius: this.slapHandRadius
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Glowing Aura silhouette
    ctx.shadowColor = this.aura > 1500 ? '#ffd700' : (this.aura > 0 ? '#00f3ff' : '#ff2a85');
    ctx.shadowBlur = this.aura > 2000 ? 25 : 12;

    // Torso
    ctx.save();
    ctx.rotate(this.torsoAngle);
    ctx.fillStyle = '#2b2d42';
    ctx.strokeStyle = '#8d99ae';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-12, -20, 24, 40, 8);
    ctx.fill();
    ctx.stroke();

    // Hoodie / Shirt graphic
    ctx.fillStyle = '#ff2a85';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AURA', 0, 5);

    // Head
    ctx.save();
    ctx.translate(0, -28);
    ctx.rotate(this.headAngle);
    ctx.fillStyle = '#ffe0bd';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Funny Gen Z messy hairstyle
    ctx.fillStyle = '#3a2e39';
    ctx.beginPath();
    ctx.arc(0, -5, 14, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes (Expressive: cooked if stunned)
    if (this.stunned > 0) {
      ctx.strokeStyle = '#d90429';
      ctx.lineWidth = 2;
      // 'X' eyes
      ctx.beginPath();
      ctx.moveTo(-7, -4); ctx.lineTo(-3, 0);
      ctx.moveTo(-3, -4); ctx.lineTo(-7, 0);
      ctx.moveTo(3, -4); ctx.lineTo(7, 0);
      ctx.moveTo(7, -4); ctx.lineTo(3, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-4 * this.facing, -2, 2.5, 0, Math.PI * 2);
      ctx.arc(4 * this.facing, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore(); // Head end

    // Legs
    ctx.strokeStyle = '#1d3557';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';

    // Left Leg
    ctx.save();
    ctx.translate(-6, 18);
    ctx.rotate(this.legL);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 22);
    ctx.stroke();
    // Shoe
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.facing > 0 ? -2 : -8, 20, 10, 5);
    ctx.restore();

    // Right Leg
    ctx.save();
    ctx.translate(6, 18);
    ctx.rotate(this.legR);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 22);
    ctx.stroke();
    // Shoe
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.facing > 0 ? -2 : -8, 20, 10, 5);
    ctx.restore();

    // Left Arm (Back arm)
    ctx.save();
    ctx.translate(-10, -12);
    ctx.rotate(this.armL);
    ctx.strokeStyle = '#ffe0bd';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();

    // Right Arm / Slap Arm
    ctx.save();
    ctx.translate(10, -12);
    if (this.isSlapping) {
      ctx.rotate(this.slapAngle);
      ctx.strokeStyle = '#ff2a85';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(34, 0);
      ctx.stroke();

      // Giant Glowing Slap Hand / Flyswatter
      ctx.fillStyle = '#ff2a85';
      ctx.beginPath();
      ctx.arc(36, 0, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👋', 36, 4);

      // Swing swoosh trail
      ctx.strokeStyle = 'rgba(255, 42, 133, 0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 36, -0.6, 0.6);
      ctx.stroke();
    } else {
      ctx.rotate(this.armR);
      ctx.strokeStyle = '#ffe0bd';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 20);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore(); // Torso end
    ctx.restore();
  }
}

class Hazard {
  constructor(type, x, y, vx, vy) {
    this.type = type; // 'redflag', 'popup', 'cap', 'notification'
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.rot = 0;
    this.vrot = (Math.random() - 0.5) * 0.1;
    this.slapped = false;
    this.life = 400;

    if (type === 'redflag') {
      this.width = 44;
      this.height = 44;
      this.damage = 600;
      this.label = '🚩 RED FLAG';
    } else if (type === 'popup') {
      this.width = 90;
      this.height = 48;
      this.damage = 400;
      const memes = ['BRO REALLY THOUGHT 💀', 'SUBWAY SURFERS LORE', 'L + RATIO', 'DOOMSCROLL 10HRS', 'POV: UNEMPLOYED'];
      this.label = memes[Math.floor(Math.random() * memes.length)];
    } else if (type === 'cap') {
      this.width = 38;
      this.height = 28;
      this.damage = 350;
      this.label = '🧢 BIG CAP';
    } else if (type === 'notification') {
      this.width = 34;
      this.height = 34;
      this.damage = 250;
      this.label = '🔴 99+';
    }
  }

  update(groundY) {
    this.x += this.vx;
    this.y += this.vy;
    this.rot += this.vrot;
    this.life--;

    if (this.slapped) {
      // Once slapped, it flies high with reduced gravity
      this.vy += 0.2;
    } else {
      // Normal hazard dynamics
      if (this.type === 'redflag') {
        this.vy += 0.25; // Anvil-like drop
      } else if (this.type === 'popup') {
        this.vy += 0.08;
        if (this.y + this.height >= groundY) {
          this.y = groundY - this.height;
          this.vy = -this.vy * 0.8; // Bounce
        }
      } else if (this.type === 'cap') {
        this.vy += 0.12;
        if (this.y + this.height >= groundY) {
          this.y = groundY - this.height;
          this.vy = -6;
        }
      } else if (this.type === 'notification') {
        // slight sine wave float
        this.y += Math.sin(Date.now() * 0.005) * 1.5;
      }
    }
  }

  checkCollision(px, py, pw, ph) {
    if (this.slapped) return false;
    return (
      Math.abs(this.x - px) < (this.width / 2 + pw / 2) &&
      Math.abs(this.y - py) < (this.height / 2 + ph / 2)
    );
  }

  checkSlap(slapHitbox) {
    if (!slapHitbox || this.slapped) return false;
    const dx = this.x - slapHitbox.x;
    const dy = this.y - slapHitbox.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (this.width / 2 + slapHitbox.radius);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    if (this.type === 'redflag') {
      ctx.fillStyle = '#ff0033';
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-16, -20);
      ctx.lineTo(20, -6);
      ctx.lineTo(-16, 8);
      ctx.closePath();
      ctx.fill();

      // Flag pole
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, -22);
      ctx.lineTo(-16, 22);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('🚩', 0, 0);

    } else if (this.type === 'popup') {
      ctx.fillStyle = 'rgba(18, 18, 24, 0.9)';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 8);
      ctx.fill();
      ctx.stroke();

      // Header bar
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, 14);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('POPUP NOTIFICATION', 0, -this.height / 2 + 10);

      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(this.label, 0, 10);

    } else if (this.type === 'cap') {
      ctx.fillStyle = '#3a86ff';
      ctx.beginPath();
      ctx.arc(0, 0, 16, Math.PI, Math.PI * 2);
      ctx.fill();
      // Visor
      ctx.fillStyle = '#023e8a';
      ctx.fillRect(-18, 0, 36, 7);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🧢', 0, -3);

    } else if (this.type === 'notification') {
      ctx.fillStyle = '#e63946';
      ctx.shadowColor = '#e63946';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('99+', 0, 0);
    }

    ctx.restore();
  }
}

window.RagdollPlayer = RagdollPlayer;
window.Hazard = Hazard;
window.Particle = Particle;
