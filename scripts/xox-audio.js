// ==========================================================================
// Anti-Gravity XOX Procedural Audio Synthesizer (Native Web Audio API)
// Zero external asset dependencies - instant response & offline capable
// ==========================================================================

class XoxAudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('xox_muted') === 'true';
        this.volume = 0.25;
        this._initEvents();
    }

    _ensureContext() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    _initEvents() {
        // Resume AudioContext on first user interaction
        const unlock = () => {
            this._ensureContext();
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('xox_muted', this.muted);
        if (!this.muted) {
            this.playClick();
        }
        return this.muted;
    }

    isMuted() {
        return this.muted;
    }

    // UI Click sound
    playClick() {
        if (this.muted) return;
        this._ensureContext();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);

        gain.gain.setValueAtTime(this.volume * 0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    // X placement: High-tech sharp laser ping
    playPlaceX() {
        if (this.muted) return;
        this._ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(1040, now);
        subOsc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);

        gain.gain.setValueAtTime(this.volume * 0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        subOsc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        subOsc.start(now);
        osc.stop(now + 0.16);
        subOsc.stop(now + 0.16);
    }

    // O placement: Warm resonant harmonic pulse
    playPlaceO() {
        if (this.muted) return;
        this._ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.14);

        gain.gain.setValueAtTime(this.volume * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    // Quantum / Endless mode: Oldest piece dissolves
    playVanish() {
        if (this.muted) return;
        this._ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.22);

        gain.gain.setValueAtTime(this.volume * 0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.23);
    }

    // Victory celebration fanfare: Majestic uplifting 4-note arpeggio
    playWin() {
        if (this.muted) return;
        this._ensureContext();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const start = this.ctx.currentTime + (idx * 0.09);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = idx === 3 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(this.volume * 0.7, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + (idx === 3 ? 0.6 : 0.25));

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(start);
            osc.stop(start + (idx === 3 ? 0.65 : 0.28));
        });
    }

    // Draw / Stalemate sound
    playDraw() {
        if (this.muted) return;
        this._ensureContext();
        if (!this.ctx) return;

        const freqs = [330, 311.13]; // E4 down to D#4
        freqs.forEach((freq, idx) => {
            const start = this.ctx.currentTime + (idx * 0.12);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(this.volume * 0.5, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(start);
            osc.stop(start + 0.25);
        });
    }

    // Blitz countdown tick
    playTick() {
        if (this.muted) return;
        this._ensureContext();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(950, this.ctx.currentTime);

        gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.035);
    }
}

// Global instance export
window.xoxAudio = new XoxAudioEngine();
