/**
 * canvas-stream.js
 * Handles real-time CDP screencast rendering and two-way mouse/keyboard interaction
 * for the Human Verification / CAPTCHA solving popup modal.
 */

class ScreencastController {
    constructor(canvasId, loaderId, onInteraction) {
        this.canvas = document.getElementById(canvasId);
        this.loader = document.getElementById(loaderId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.onInteraction = onInteraction;
        this.currentImage = new Image();
        this.isStreamActive = false;
        this.viewportWidth = 1280;
        this.viewportHeight = 800;

        if (this.canvas) {
            this.bindEvents();
        }
    }

    bindEvents() {
        // Translate canvas mouse clicks to sandbox browser coordinates
        this.canvas.addEventListener('click', (e) => this.handleMouseEvent('click', e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseEvent('mousedown', e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseEvent('mouseup', e));
        
        let throttleMove = 0;
        this.canvas.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - throttleMove > 50) {
                throttleMove = now;
                this.handleMouseEvent('mousemove', e);
            }
        });

        // Keyboard inputs
        window.addEventListener('keydown', (e) => {
            if (this.isStreamActive && document.getElementById('modal-verification').style.display !== 'none') {
                if (['Tab', 'Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.key.length === 1) {
                    this.handleKeyboardEvent('keydown', e);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.isStreamActive && document.getElementById('modal-verification').style.display !== 'none') {
                this.handleKeyboardEvent('keyup', e);
            }
        });
    }

    setViewport(width, height) {
        this.viewportWidth = width || 1280;
        this.viewportHeight = height || 800;
        if (this.canvas) {
            this.canvas.width = this.viewportWidth;
            this.canvas.height = this.viewportHeight;
        }
    }

    start() {
        this.isStreamActive = true;
        if (this.loader) this.loader.style.display = 'flex';
    }

    stop() {
        this.isStreamActive = false;
        if (this.loader) this.loader.style.display = 'none';
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    renderFrame(base64Jpeg) {
        if (!this.isStreamActive || !this.ctx) return;
        
        if (this.loader && this.loader.style.display !== 'none') {
            this.loader.style.display = 'none';
        }

        const img = new Image();
        img.onload = () => {
            if (this.isStreamActive && this.ctx) {
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            }
        };
        img.src = 'data:image/jpeg;base64,' + base64Jpeg;
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        return {
            x: Math.max(0, Math.min(this.canvas.width, clientX * scaleX)),
            y: Math.max(0, Math.min(this.canvas.height, clientY * scaleY))
        };
    }

    handleMouseEvent(eventType, e) {
        if (!this.isStreamActive || !this.onInteraction) return;
        const coords = this.getCanvasCoordinates(e);
        let button = 'left';
        if (e.button === 1) button = 'middle';
        if (e.button === 2) button = 'right';

        this.onInteraction({
            eventType,
            x: coords.x,
            y: coords.y,
            button
        });
    }

    handleKeyboardEvent(eventType, e) {
        if (!this.isStreamActive || !this.onInteraction) return;
        this.onInteraction({
            eventType,
            key: e.key,
            code: e.code,
            text: e.key.length === 1 ? e.key : undefined
        });
    }
}

window.ScreencastController = ScreencastController;
