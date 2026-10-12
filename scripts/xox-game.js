// ==========================================================================
// Anti-Gravity XOX (Hyper Tic-Tac-Toe) Master Game Coordinator
// Handles game state, turns, UI rendering, canvas laser lines, timer, & controls
// ==========================================================================

class XoxGame {
    constructor() {
        // Game Settings
        this.mode = 'pve'; // 'pve' | 'pvp'
        this.difficulty = 'hard'; // 'easy' | 'medium' | 'hard'
        this.gridSize = 3; // 3 | 4 | 5
        this.isQuantum = false; // Endless 3-piece anti-gravity mode
        this.isBlitz = false; // 5-second blitz timer

        // Match State
        this.board = [];
        this.currentPlayer = 'X';
        this.isGameOver = false;
        this.isAiThinking = false;
        this.pieceQueues = { X: [], O: [] }; // Stores cell indices in order of placement
        this.winningLine = null;

        // Blitz Timer State
        this.blitzDuration = 5;
        this.blitzRemaining = 5;
        this.blitzTimerId = null;

        // Statistics
        this.stats = this._loadStats();

        // Cached DOM Elements
        this.dom = {};
        this._cacheDom();
        this._bindEvents();
    }

    _cacheDom() {
        this.dom.boardGrid = document.getElementById('board-grid');
        this.dom.strikeCanvas = document.getElementById('strike-canvas');
        this.dom.statusMessage = document.getElementById('status-message');
        this.dom.blitzWrap = document.getElementById('blitz-wrap');
        this.dom.blitzSeconds = document.getElementById('blitz-seconds');
        this.dom.blitzBarFill = document.getElementById('blitz-bar-fill');

        // Cards & Scores
        this.dom.cardX = document.getElementById('card-player-x');
        this.dom.cardO = document.getElementById('card-player-o');
        this.dom.scoreX = document.getElementById('score-x');
        this.dom.scoreO = document.getElementById('score-o');
        this.dom.roleO = document.getElementById('role-o');
        this.dom.queueTrayX = document.getElementById('queue-tray-x');
        this.dom.queueTrayO = document.getElementById('queue-tray-o');

        // Sidebar Stats
        this.dom.statXWins = document.getElementById('stat-x-wins');
        this.dom.statOWins = document.getElementById('stat-o-wins');
        this.dom.statDraws = document.getElementById('stat-draws');
        this.dom.statStreak = document.getElementById('stat-streak');
        this.dom.statWinRate = document.getElementById('stat-win-rate');

        // Modals
        this.dom.modalBackdrop = document.getElementById('modal-backdrop');
        this.dom.modalTitle = document.getElementById('modal-title');
        this.dom.modalSubtitle = document.getElementById('modal-subtitle');
        this.dom.modalIcon = document.getElementById('modal-icon');
        this.dom.btnModalRematch = document.getElementById('btn-modal-rematch');
        this.dom.btnModalClose = document.getElementById('btn-modal-close');

        // Rules Modal
        this.dom.rulesModal = document.getElementById('rules-modal');
    }

    init() {
        this._updateStatsUI();
        this.startNewMatch();
    }

    _bindEvents() {
        // Mode Selector Buttons (PvE vs PvP)
        document.querySelectorAll('[data-game-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                document.querySelectorAll('[data-game-mode]').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                this.mode = target.getAttribute('data-game-mode');
                if (window.xoxAudio) window.xoxAudio.playClick();
                this._updatePlayerRoles();
                this.startNewMatch();
            });
        });

        // Difficulty Selector Buttons
        document.querySelectorAll('[data-diff]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                this.difficulty = target.getAttribute('data-diff');
                if (window.xoxAudio) window.xoxAudio.playClick();
                this.startNewMatch();
            });
        });

        // Grid Size Buttons
        document.querySelectorAll('[data-grid-size]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                document.querySelectorAll('[data-grid-size]').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                this.gridSize = parseInt(target.getAttribute('data-grid-size'), 10);
                if (window.xoxAudio) window.xoxAudio.playClick();
                this.startNewMatch();
            });
        });

        // Quantum / Endless 3-Piece Mode Toggle
        const btnQuantum = document.getElementById('btn-quantum-mode');
        if (btnQuantum) {
            btnQuantum.addEventListener('click', () => {
                this.isQuantum = !this.isQuantum;
                btnQuantum.classList.toggle('active', this.isQuantum);
                if (window.xoxAudio) window.xoxAudio.playClick();
                this._toggleQuantumTrays(this.isQuantum);
                this.startNewMatch();
            });
        }

        // Blitz Mode Toggle
        const btnBlitz = document.getElementById('btn-toggle-blitz');
        if (btnBlitz) {
            btnBlitz.addEventListener('click', () => {
                this.isBlitz = !this.isBlitz;
                btnBlitz.classList.toggle('active', this.isBlitz);
                if (this.dom.blitzWrap) {
                    this.dom.blitzWrap.style.display = this.isBlitz ? 'flex' : 'none';
                }
                if (window.xoxAudio) window.xoxAudio.playClick();
                this.startNewMatch();
            });
        }

        // Restart Match Button
        const btnRestart = document.getElementById('btn-restart');
        if (btnRestart) {
            btnRestart.addEventListener('click', () => {
                if (window.xoxAudio) window.xoxAudio.playClick();
                this.startNewMatch();
            });
        }

        // Modal Buttons
        if (this.dom.btnModalRematch) {
            this.dom.btnModalRematch.addEventListener('click', () => {
                this._closeModal();
                if (window.xoxAudio) window.xoxAudio.playClick();
                this.startNewMatch();
            });
        }
        if (this.dom.btnModalClose) {
            this.dom.btnModalClose.addEventListener('click', () => {
                this._closeModal();
                if (window.xoxAudio) window.xoxAudio.playClick();
            });
        }

        // Reset Stats Button
        const btnResetStats = document.getElementById('btn-reset-stats');
        if (btnResetStats) {
            btnResetStats.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all match statistics?')) {
                    this._resetStats();
                    if (window.xoxAudio) window.xoxAudio.playClick();
                }
            });
        }

        // Rules Modal Toggles
        const btnRules = document.getElementById('btn-rules');
        const btnCloseRules = document.getElementById('btn-close-rules');
        if (btnRules && this.dom.rulesModal) {
            btnRules.addEventListener('click', () => {
                this.dom.rulesModal.classList.add('open');
                if (window.xoxAudio) window.xoxAudio.playClick();
            });
        }
        if (btnCloseRules && this.dom.rulesModal) {
            btnCloseRules.addEventListener('click', () => {
                this.dom.rulesModal.classList.remove('open');
                if (window.xoxAudio) window.xoxAudio.playClick();
            });
        }

        // Sound Toggle
        const btnSound = document.getElementById('btn-toggle-sound');
        if (btnSound) {
            btnSound.addEventListener('click', () => {
                const isMuted = window.xoxAudio.toggleMute();
                btnSound.classList.toggle('active', !isMuted);
                btnSound.querySelector('span').textContent = isMuted ? 'SOUND: OFF' : 'SOUND: ON';
            });
            // Initial state
            if (window.xoxAudio.isMuted()) {
                btnSound.classList.remove('active');
                btnSound.querySelector('span').textContent = 'SOUND: OFF';
            } else {
                btnSound.classList.add('active');
                btnSound.querySelector('span').textContent = 'SOUND: ON';
            }
        }

        // Keyboard & Numpad Listeners
        window.addEventListener('keydown', (e) => this._handleKeyboard(e));
    }

    _handleKeyboard(e) {
        if (this.isGameOver || this.isAiThinking) return;

        // 'R' key restarts
        if (e.key.toLowerCase() === 'r') {
            this.startNewMatch();
            return;
        }

        // Numpad & Number mapping for 3x3
        if (this.gridSize === 3) {
            // Standard Numpad layout:
            // 7 8 9
            // 4 5 6
            // 1 2 3
            const numpadMap = {
                'Numpad7': 0, 'Numpad8': 1, 'Numpad9': 2,
                'Numpad4': 3, 'Numpad5': 4, 'Numpad6': 5,
                'Numpad1': 6, 'Numpad2': 7, 'Numpad3': 8,
                'Digit1': 0, 'Digit2': 1, 'Digit3': 2,
                'Digit4': 3, 'Digit5': 4, 'Digit6': 5,
                'Digit7': 6, 'Digit8': 7, 'Digit9': 8
            };

            const cellIndex = numpadMap[e.code];
            if (cellIndex !== undefined && !this.board[cellIndex]) {
                this.makeMove(cellIndex);
            }
        }
    }

    _updatePlayerRoles() {
        if (this.dom.roleO) {
            this.dom.roleO.textContent = this.mode === 'pve' ? `AI (${this.difficulty.toUpperCase()})` : 'PLAYER 2';
        }
    }

    _toggleQuantumTrays(show) {
        if (this.dom.queueTrayX) this.dom.queueTrayX.style.display = show ? 'flex' : 'none';
        if (this.dom.queueTrayO) this.dom.queueTrayO.style.display = show ? 'flex' : 'none';
    }

    startNewMatch() {
        this._stopBlitzTimer();
        this._closeModal();
        this.isGameOver = false;
        this.isAiThinking = false;
        this.currentPlayer = 'X';
        this.board = new Array(this.gridSize * this.gridSize).fill(null);
        this.pieceQueues = { X: [], O: [] };
        this.winningLine = null;

        this._clearStrikeCanvas();
        this._renderGrid();
        this._updateTurnHUD();

        if (this.isBlitz) {
            this._startBlitzTimer();
        }
    }

    _renderGrid() {
        if (!this.dom.boardGrid) return;
        this.dom.boardGrid.innerHTML = '';
        this.dom.boardGrid.className = `board-grid size-${this.gridSize}`;

        for (let i = 0; i < this.board.length; i++) {
            const cell = document.createElement('button');
            cell.className = 'cell';
            cell.setAttribute('data-index', i);
            cell.setAttribute('aria-label', `Cell ${i + 1}`);

            // Key hint for 3x3
            if (this.gridSize === 3) {
                const hint = document.createElement('span');
                hint.className = 'key-hint';
                hint.textContent = i + 1;
                cell.appendChild(hint);
            }

            cell.addEventListener('click', () => {
                if (this.isGameOver || this.isAiThinking) return;
                if (this.mode === 'pve' && this.currentPlayer === 'O') return;
                this.makeMove(i);
            });

            this.dom.boardGrid.appendChild(cell);
        }
    }

    makeMove(cellIndex) {
        if (this.board[cellIndex] || this.isGameOver) return;

        const player = this.currentPlayer;

        // In Quantum / Endless mode: Handle 3-piece limit!
        if (this.isQuantum && this.pieceQueues[player].length >= 3) {
            const oldestIndex = this.pieceQueues[player].shift();
            this.board[oldestIndex] = null;
            this._removeMarkFromCell(oldestIndex);
            if (window.xoxAudio) window.xoxAudio.playVanish();
        }

        // Place new mark
        this.board[cellIndex] = player;
        this.pieceQueues[player].push(cellIndex);
        this._drawMarkInCell(cellIndex, player);

        // Sound effect
        if (window.xoxAudio) {
            if (player === 'X') window.xoxAudio.playPlaceX();
            else window.xoxAudio.playPlaceO();
        }

        // Update Quantum Queue HUD & highlight oldest piece that will dissolve next
        this._updateQuantumVisuals();

        // Check for Win or Draw
        const win = this._checkWin();
        if (win) {
            this._handleWin(player, win);
            return;
        }

        if (this._checkDraw()) {
            this._handleDraw();
            return;
        }

        // Switch Turn
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        this._updateTurnHUD();

        // Reset Blitz timer for next player
        if (this.isBlitz) {
            this._resetBlitzTimer();
        }

        // AI Turn Trigger (if PvE)
        if (this.mode === 'pve' && this.currentPlayer === 'O' && !this.isGameOver) {
            this.isAiThinking = true;
            this._setCellsDisabled(true);

            // Realistic thinking delay (350ms - 600ms)
            const delay = Math.floor(Math.random() * 250) + 350;
            setTimeout(() => {
                if (this.isGameOver) return;
                const aiMove = window.xoxAI.getBestMove(
                    [...this.board],
                    this.gridSize,
                    this.difficulty,
                    this.isQuantum,
                    { X: [...this.pieceQueues.X], O: [...this.pieceQueues.O] }
                );

                this.isAiThinking = false;
                this._setCellsDisabled(false);

                if (aiMove !== -1) {
                    this.makeMove(aiMove);
                }
            }, delay);
        }
    }

    _drawMarkInCell(index, player) {
        const cell = this.dom.boardGrid.querySelector(`[data-index="${index}"]`);
        if (!cell) return;

        cell.classList.add('occupied');
        // SVG Mark definition
        if (player === 'X') {
            cell.innerHTML = `
                <svg class="mark-svg mark-x" viewBox="0 0 50 50">
                    <line x1="12" y1="12" x2="38" y2="38" />
                    <line x1="38" y1="12" x2="12" y2="38" />
                </svg>
            `;
        } else {
            cell.innerHTML = `
                <svg class="mark-svg mark-o" viewBox="0 0 50 50">
                    <circle cx="25" cy="25" r="14" />
                </svg>
            `;
        }
    }

    _removeMarkFromCell(index) {
        const cell = this.dom.boardGrid.querySelector(`[data-index="${index}"]`);
        if (!cell) return;
        cell.classList.remove('occupied', 'mark-fading-soon');
        cell.innerHTML = '';
        if (this.gridSize === 3) {
            const hint = document.createElement('span');
            hint.className = 'key-hint';
            hint.textContent = index + 1;
            cell.appendChild(hint);
        }
    }

    _updateQuantumVisuals() {
        if (!this.isQuantum) return;

        // Clear all previous fade-soon warnings
        this.dom.boardGrid.querySelectorAll('.cell').forEach(c => c.classList.remove('mark-fading-soon'));

        // If player has 3 pieces, the oldest will vanish next!
        ['X', 'O'].forEach(p => {
            const queue = this.pieceQueues[p];
            if (queue.length === 3) {
                const oldestIdx = queue[0];
                const cell = this.dom.boardGrid.querySelector(`[data-index="${oldestIdx}"]`);
                if (cell) cell.classList.add('mark-fading-soon');
            }

            // Update queue tray slots
            const tray = p === 'X' ? this.dom.queueTrayX : this.dom.queueTrayO;
            if (tray) {
                const slots = tray.querySelectorAll('.tray-slot');
                slots.forEach((slot, idx) => {
                    slot.className = 'tray-slot';
                    if (idx < queue.length) {
                        slot.classList.add(p === 'X' ? 'filled-x' : 'filled-o');
                        slot.textContent = p;
                        if (queue.length === 3 && idx === 0) {
                            slot.classList.add('oldest-warning');
                        }
                    } else {
                        slot.textContent = '';
                    }
                });
            }
        });
    }

    _setCellsDisabled(disabled) {
        this.dom.boardGrid.querySelectorAll('.cell:not(.occupied)').forEach(c => {
            c.classList.toggle('disabled', disabled);
        });
    }

    _updateTurnHUD() {
        const isX = this.currentPlayer === 'X';
        if (this.dom.cardX) this.dom.cardX.classList.toggle('active-turn', isX);
        if (this.dom.cardO) this.dom.cardO.classList.toggle('active-turn', !isX);

        if (this.dom.statusMessage) {
            const pName = isX ? 'PLAYER X' : (this.mode === 'pve' ? 'AI' : 'PLAYER O');
            this.dom.statusMessage.innerHTML = `
                <span class="dot" style="background:${isX ? 'var(--color-x)' : 'var(--color-o)'}; box-shadow:0 0 10px ${isX ? 'var(--color-x)' : 'var(--color-o)'}"></span>
                ${pName}'S TURN
            `;
        }
    }

    _checkWin() {
        const winLines = window.xoxAI.getWinningCombinations(this.gridSize);
        for (let line of winLines) {
            const first = this.board[line[0]];
            if (first && line.every(idx => this.board[idx] === first)) {
                return line;
            }
        }
        return null;
    }

    _checkDraw() {
        // In Quantum mode, draws are practically impossible because pieces circulate,
        // but if board somehow fills without a winner:
        return this.board.every(cell => cell !== null);
    }

    _handleWin(winner, winLine) {
        this.isGameOver = true;
        this._stopBlitzTimer();
        this.winningLine = winLine;

        // Highlight winning cells
        winLine.forEach(idx => {
            const cell = this.dom.boardGrid.querySelector(`[data-index="${idx}"]`);
            if (cell) cell.classList.add('win-cell');
        });

        // Draw animated laser strike line connecting the winning cells
        this._drawStrikeLine(winLine, winner);

        // Sound & Confetti
        if (window.xoxAudio) window.xoxAudio.playWin();
        if (window.xoxParticles) {
            window.xoxParticles.spawnVictoryConfetti(winner);
        }

        // Record stats
        if (winner === 'X') {
            this.stats.xWins++;
            this.stats.streak++;
            if (this.stats.streak > this.stats.bestStreak) {
                this.stats.bestStreak = this.stats.streak;
            }
        } else {
            this.stats.oWins++;
            this.stats.streak = 0;
        }
        this.stats.totalGames++;
        this._saveStats();
        this._updateStatsUI();

        // Show Modal after brief laser showcase delay
        setTimeout(() => {
            this._showWinModal(winner);
        }, 800);
    }

    _handleDraw() {
        this.isGameOver = true;
        this._stopBlitzTimer();

        if (window.xoxAudio) window.xoxAudio.playDraw();
        this.stats.draws++;
        this.stats.streak = 0;
        this.stats.totalGames++;
        this._saveStats();
        this._updateStatsUI();

        setTimeout(() => {
            this._showDrawModal();
        }, 500);
    }

    _drawStrikeLine(lineIndices, winner) {
        const canvas = this.dom.strikeCanvas;
        if (!canvas) return;

        const rect = this.dom.boardGrid.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');

        const firstCell = this.dom.boardGrid.querySelector(`[data-index="${lineIndices[0]}"]`);
        const lastCell = this.dom.boardGrid.querySelector(`[data-index="${lineIndices[lineIndices.length - 1]}"]`);
        if (!firstCell || !lastCell) return;

        const r1 = firstCell.getBoundingClientRect();
        const r2 = lastCell.getBoundingClientRect();

        const x1 = r1.left - rect.left + r1.width / 2;
        const y1 = r1.top - rect.top + r1.height / 2;
        const x2 = r2.left - rect.left + r2.width / 2;
        const y2 = r2.top - rect.top + r2.height / 2;

        const glowColor = winner === 'X' ? '#00f0ff' : '#ff007f';

        // Animated laser extension
        let progress = 0;
        const animate = () => {
            progress += 0.08;
            if (progress > 1) progress = 1;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();

            const curX = x1 + (x2 - x1) * progress;
            const curY = y1 + (y2 - y1) * progress;

            // Outer Neon Glow
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(curX, curY);
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 24;
            ctx.stroke();

            // Core White Beam
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(curX, curY);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.restore();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    _clearStrikeCanvas() {
        const canvas = this.dom.strikeCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    _showWinModal(winner) {
        if (!this.dom.modalBackdrop) return;
        const isX = winner === 'X';
        const pName = isX ? 'PLAYER X' : (this.mode === 'pve' ? 'AI' : 'PLAYER O');

        this.dom.modalTitle.textContent = `${pName} WINS!`;
        this.dom.modalTitle.style.color = isX ? 'var(--color-x)' : 'var(--color-o)';
        this.dom.modalSubtitle.textContent = isX 
            ? (this.mode === 'pve' ? 'Spectacular victory against the AI!' : 'Player X dominated the grid!')
            : (this.mode === 'pve' ? 'The machine claimed supremacy. Rematch?' : 'Player O seized the win!');

        this.dom.modalIcon.innerHTML = isX 
            ? `<span style="color:var(--color-x); text-shadow:0 0 15px var(--color-x-glow)">X</span>`
            : `<span style="color:var(--color-o); text-shadow:0 0 15px var(--color-o-glow)">O</span>`;

        this.dom.modalBackdrop.classList.add('open');
    }

    _showDrawModal() {
        if (!this.dom.modalBackdrop) return;
        this.dom.modalTitle.textContent = 'STALEMATE!';
        this.dom.modalTitle.style.color = 'var(--color-gold)';
        this.dom.modalSubtitle.textContent = 'A perfectly balanced duel. Neither side yielded an inch.';
        this.dom.modalIcon.innerHTML = `<span style="color:var(--color-gold)">⚖</span>`;
        this.dom.modalBackdrop.classList.add('open');
    }

    _closeModal() {
        if (this.dom.modalBackdrop) {
            this.dom.modalBackdrop.classList.remove('open');
        }
    }

    // Blitz 5-Second Timer
    _startBlitzTimer() {
        this.blitzRemaining = this.blitzDuration;
        this._updateBlitzUI();
        clearInterval(this.blitzTimerId);

        this.blitzTimerId = setInterval(() => {
            this.blitzRemaining -= 0.1;
            if (this.blitzRemaining <= 0) {
                this.blitzRemaining = 0;
                this._handleBlitzTimeout();
            } else {
                if (Math.floor(this.blitzRemaining) !== Math.floor(this.blitzRemaining + 0.1) && this.blitzRemaining <= 2) {
                    if (window.xoxAudio) window.xoxAudio.playTick();
                }
            }
            this._updateBlitzUI();
        }, 100);
    }

    _resetBlitzTimer() {
        this._startBlitzTimer();
    }

    _stopBlitzTimer() {
        clearInterval(this.blitzTimerId);
        this.blitzTimerId = null;
    }

    _updateBlitzUI() {
        if (!this.dom.blitzSeconds || !this.dom.blitzBarFill) return;
        this.dom.blitzSeconds.textContent = `${Math.ceil(this.blitzRemaining)}s`;
        const pct = (this.blitzRemaining / this.blitzDuration) * 100;
        this.dom.blitzBarFill.style.width = `${pct}%`;
        this.dom.blitzBarFill.style.background = this.blitzRemaining <= 1.5 ? '#ff4757' : 'var(--color-gold)';
    }

    _handleBlitzTimeout() {
        this._stopBlitzTimer();
        // Timed-out player loses turn or forfeits to other player
        const forfeitedWinner = this.currentPlayer === 'X' ? 'O' : 'X';
        this._handleWin(forfeitedWinner, []);
    }

    // Statistics Persistence
    _loadStats() {
        const stored = localStorage.getItem('xox_stats');
        if (stored) {
            try { return JSON.parse(stored); } catch(e) {}
        }
        return {
            xWins: 0,
            oWins: 0,
            draws: 0,
            streak: 0,
            bestStreak: 0,
            totalGames: 0
        };
    }

    _saveStats() {
        localStorage.setItem('xox_stats', JSON.stringify(this.stats));
    }

    _resetStats() {
        this.stats = {
            xWins: 0,
            oWins: 0,
            draws: 0,
            streak: 0,
            bestStreak: 0,
            totalGames: 0
        };
        this._saveStats();
        this._updateStatsUI();
    }

    _updateStatsUI() {
        if (this.dom.scoreX) this.dom.scoreX.textContent = this.stats.xWins;
        if (this.dom.scoreO) this.dom.scoreO.textContent = this.stats.oWins;
        if (this.dom.statXWins) this.dom.statXWins.textContent = this.stats.xWins;
        if (this.dom.statOWins) this.dom.statOWins.textContent = this.stats.oWins;
        if (this.dom.statDraws) this.dom.statDraws.textContent = this.stats.draws;
        if (this.dom.statStreak) this.dom.statStreak.textContent = `${this.stats.streak} (Best: ${this.stats.bestStreak})`;

        const winRate = this.stats.totalGames > 0
            ? Math.round((this.stats.xWins / this.stats.totalGames) * 100)
            : 0;
        if (this.dom.statWinRate) this.dom.statWinRate.textContent = `${winRate}%`;
    }
}

// Instantiate game on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Start particle engine
    window.xoxParticles = new XoxParticleEngine('particles-canvas');
    // Start game coordinator
    window.xoxGame = new XoxGame();
    window.xoxGame.init();
});
