// Interactive Cyber Defense Grid & Telemetry Node Canvas Animation
// Lightweight, battery-friendly, high-performance 60fps rendering

class TelemetryCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.packets = [];
        this.mouse = { x: null, y: null, radius: 120 };
        this.numNodes = 55;
        this.animationFrameId = null;

        this.init();
        this.bindEvents();
        this.animate = this.animate.bind(this);
        this.animate();
    }

    init() {
        this.resize();
        this.nodes = [];
        this.packets = [];

        // Dynamic density based on screen width
        this.numNodes = Math.floor(Math.min(window.innerWidth / 22, 65));

        for (let i = 0; i < this.numNodes; i++) {
            this.nodes.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.45,
                vy: (Math.random() - 0.5) * 0.45,
                radius: Math.random() * 1.8 + 1.2,
                color: Math.random() > 0.85 ? '#00ff9d' : (Math.random() > 0.7 ? '#ff0055' : '#00f0ff'),
                pulse: Math.random() * Math.PI * 2
            });
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    bindEvents() {
        window.addEventListener('resize', () => this.init());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    spawnPacket(n1, n2) {
        if (this.packets.length > 25) return;
        this.packets.push({
            startX: n1.x,
            startY: n1.y,
            targetX: n2.x,
            targetY: n2.y,
            progress: 0,
            speed: 0.02 + Math.random() * 0.02,
            color: n1.color
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render nodes
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            node.x += node.vx;
            node.y += node.vy;
            node.pulse += 0.03;

            // Bounce on canvas edges
            if (node.x < 0 || node.x > this.canvas.width) node.vx *= -1;
            if (node.y < 0 || node.y > this.canvas.height) node.vy *= -1;

            // Mouse proximity reactivity
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = this.mouse.x - node.x;
                const dy = this.mouse.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const force = (this.mouse.radius - dist) / this.mouse.radius;
                    node.x -= (dx / dist) * force * 1.8;
                    node.y -= (dy / dist) * force * 1.8;
                }
            }

            // Draw glowing node
            const currentRadius = node.radius + Math.sin(node.pulse) * 0.4;
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = node.color;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = node.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Connect nearby nodes
            for (let j = i + 1; j < this.nodes.length; j++) {
                const other = this.nodes[j];
                const dx = other.x - node.x;
                const dy = other.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 130) {
                    const alpha = (1 - dist / 130) * 0.22;
                    this.ctx.beginPath();
                    this.ctx.moveTo(node.x, node.y);
                    this.ctx.lineTo(other.x, other.y);
                    this.ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
                    this.ctx.lineWidth = 0.85;
                    this.ctx.stroke();

                    // Random telemetry packet transmission
                    if (Math.random() < 0.0008) {
                        this.spawnPacket(node, other);
                    }
                }
            }
        }

        // Render traveling data packets
        for (let k = this.packets.length - 1; k >= 0; k--) {
            const p = this.packets[k];
            p.progress += p.speed;
            if (p.progress >= 1) {
                this.packets.splice(k, 1);
                continue;
            }
            const px = p.startX + (p.targetX - p.startX) * p.progress;
            const py = p.startY + (p.targetY - p.startY) * p.progress;

            this.ctx.beginPath();
            this.ctx.arc(px, py, 2.2, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }

        this.animationFrameId = requestAnimationFrame(this.animate);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TelemetryCanvas('telemetry-canvas');
});
