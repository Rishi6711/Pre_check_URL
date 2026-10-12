// Procedural Cyber Audio Synthesizer via Web Audio API
// Generates subtle tactical sound effects without external audio assets

class CyberSoundManager {
    constructor() {
        this.ctx = null;
        this.muted = true; // Muted by default for accessibility and non-intrusiveness
        this.initOnFirstInteraction = this.initOnFirstInteraction.bind(this);
        
        window.addEventListener('click', this.initOnFirstInteraction, { once: true });
        window.addEventListener('keydown', this.initOnFirstInteraction, { once: true });
    }

    initOnFirstInteraction() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (!this.muted && this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (!this.muted) {
            this.playChime();
        }
        return this.muted;
    }

    isMuted() {
        return this.muted;
    }

    playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.04) {
        if (this.muted || !this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio policy or inactive context fallback
        }
    }

    playKey() {
        const freqs = [780, 820, 880, 940, 1020];
        const randomFreq = freqs[Math.floor(Math.random() * freqs.length)];
        this.playTone(randomFreq, 'triangle', 0.03, 0.02);
    }

    playClick() {
        this.playTone(1200, 'sine', 0.04, 0.03);
    }

    playChime() {
        if (this.muted || !this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, index) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.15, 0.04);
            }, index * 60);
        });
    }

    playError() {
        if (this.muted || !this.ctx) return;
        this.playTone(220, 'sawtooth', 0.12, 0.04);
        setTimeout(() => {
            this.playTone(180, 'sawtooth', 0.18, 0.05);
        }, 80);
    }
}

window.cyberSound = new CyberSoundManager();
