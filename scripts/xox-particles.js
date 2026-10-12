// ==========================================================================
// Anti-Gravity Particles & Confetti FX Engine
// Ambient anti-gravity floating field + celebratory neon particle explosions
// ==========================================================================

class XoxParticleEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.ambientParticles = [];
        this.confettiParticles = [];
        this.mouse = { x: -9999, y: -9999, radius: 120 };
        this.isRunning = true;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('pointermove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('pointerleave', () => {
            this.mouse.x = -9999;
            this.mouse.y = -9999;
        });

        this._createAmbientParticles(45);
        this._loop();
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    }

    _createAmbientParticles(count) {
        this.ambientParticles = [];
        const colors = [
            'rgba(0, 240, 255, ',
            'rgba(255, 0, 127, ',
            'rgba(255, 230, 0, ',
            'rgba(140, 155, 200, '
        ];

        for (let i = 0; i < count; i++) {
            this.ambientParticles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2.5 + 1.2,
                colorPrefix: colors[Math.floor(Math.random() * colors.length)],
                alpha: Math.random() * 0.4 + 0.15,
                vx: (Math.random() - 0.5) * 0.6,
                vy: -(Math.random() * 0.6 + 0.2), // Upward anti-gravity drift!
                type: Math.random() > 0.6 ? 'cross' : (Math.random() > 0.4 ? 'circle' : 'dot'),
                angle: Math.random() * Math.PI * 2,
                spinSpeed: (Math.random() - 0.5) * 0.02
            });
        }
    }

    // Launch victory neon burst
    spawnVictoryConfetti(winner, originX, originY) {
        const count = 90;
        const colorPrefix = winner === 'X' ? 'rgba(0, 240, 255, ' : (winner === 'O' ? 'rgba(255, 0, 127, ' : 'rgba(255, 230, 0, ');
        const startX = originX || this.width / 2;
        const startY = originY || this.height / 2;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 9 + 3;
            this.confettiParticles.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2, // Slight initial upward burst
                size: Math.random() * 5 + 3,
                colorPrefix: Math.random() > 0.25 ? colorPrefix : 'rgba(255, 255, 255, ',
                alpha: 1,
                decay: Math.random() * 0.015 + 0.01,
                rotation: Math.random() * Math.PI,
                rotSpeed: (Math.random() - 0.5) * 0.15,
                shape: Math.random() > 0.5 ? 'spark' : 'ribbon'
            });
        }
    }

    _loop() {
        if (!this.isRunning) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update & Draw Ambient Nodes
        for (let p of this.ambientParticles) {
            // Anti-gravity upward movement
            p.x += p.vx;
            p.y += p.vy;
            p.angle += p.spinSpeed;

            // Screen wrap
            if (p.y < -20) {
                p.y = this.height + 20;
                p.x = Math.random() * this.width;
            }
            if (p.x < -20) p.x = this.width + 20;
            if (p.x > this.width + 20) p.x = -20;

            // Mouse repulsion
            const dx = p.x - this.mouse.x;
            const dy = p.y - this.mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.mouse.radius && dist > 0) {
                const force = (1 - dist / this.mouse.radius) * 2.5;
                p.x += (dx / dist) * force;
                p.y += (dy / dist) * force;
            }

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.angle);
            this.ctx.fillStyle = `${p.colorPrefix}${p.alpha})`;
            this.ctx.strokeStyle = `${p.colorPrefix}${p.alpha})`;
            this.ctx.lineWidth = 1.2;

            if (p.type === 'cross') {
                const s = p.size * 1.8;
                this.ctx.beginPath();
                this.ctx.moveTo(-s, -s);
                this.ctx.lineTo(s, s);
                this.ctx.moveTo(s, -s);
                this.ctx.lineTo(-s, s);
                this.ctx.stroke();
            } else if (p.type === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size * 1.2, 0, Math.PI * 2);
                this.ctx.stroke();
            } else {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }

        // Draw faint connecting constellations between close ambient nodes
        for (let i = 0; i < this.ambientParticles.length; i++) {
            for (let j = i + 1; j < this.ambientParticles.length; j++) {
                const p1 = this.ambientParticles[i];
                const p2 = this.ambientParticles[j];
                const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (d < 75) {
                    this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 * (1 - d / 75)})`;
                    this.ctx.lineWidth = 0.6;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }

        // Update & Draw Celebratory Confetti / Laser Sparks
        for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
            const cp = this.confettiParticles[i];
            cp.x += cp.vx;
            cp.y += cp.vy;
            cp.vy += 0.16; // gravity for burst
            cp.vx *= 0.98;
            cp.alpha -= cp.decay;
            cp.rotation += cp.rotSpeed;

            if (cp.alpha <= 0) {
                this.confettiParticles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.translate(cp.x, cp.y);
            this.ctx.rotate(cp.rotation);
            this.ctx.fillStyle = `${cp.colorPrefix}${cp.alpha})`;
            this.ctx.shadowColor = `${cp.colorPrefix}0.8)`;
            this.ctx.shadowBlur = 8;

            if (cp.shape === 'spark') {
                this.ctx.fillRect(-cp.size / 2, -1, cp.size, 2);
            } else {
                this.ctx.fillRect(-cp.size / 2, -cp.size / 3, cp.size, cp.size * 0.7);
            }

            this.ctx.restore();
        }

        requestAnimationFrame(() => this._loop());
    }
}

// Global instance export
window.XoxParticleEngine = XoxParticleEngine;
