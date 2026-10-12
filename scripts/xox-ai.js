// ==========================================================================
// Anti-Gravity XOX Smart AI Engine
// Supports Novice, Tactician, and Unbeatable Grandmaster (Minimax + Heuristics)
// Compatible with 3x3, 4x4, 5x5 and Quantum 3-Piece mode
// ==========================================================================

class XoxAI {
    constructor() {
        this.aiPlayer = 'O';
        this.humanPlayer = 'X';
    }

    /**
     * Compute the best move index for the given game state
     * @param {Array} board - Array representing cells (e.g., length 9, 16, or 25)
     * @param {number} size - Board grid size (3, 4, or 5)
     * @param {string} difficulty - 'easy' | 'medium' | 'hard'
     * @param {boolean} isQuantum - Whether 3-piece limit is active
     * @param {Object} pieceQueues - { X: [indices], O: [indices] }
     * @returns {number} cell index to play
     */
    getBestMove(board, size, difficulty, isQuantum = false, pieceQueues = { X: [], O: [] }) {
        const availableMoves = this._getAvailableMoves(board);
        if (availableMoves.length === 0) return -1;

        // Novice (Easy): mostly random moves, casual play
        if (difficulty === 'easy') {
            if (Math.random() < 0.35) {
                const winMove = this._findImmediateWin(board, size, this.aiPlayer, isQuantum, pieceQueues);
                if (winMove !== -1) return winMove;
            }
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }

        // Tactician (Medium): tactical attack/defense
        if (difficulty === 'medium') {
            // 1. Can AI win immediately?
            const winMove = this._findImmediateWin(board, size, this.aiPlayer, isQuantum, pieceQueues);
            if (winMove !== -1) return winMove;

            // 2. Can Human win immediately? Block them!
            const blockMove = this._findImmediateWin(board, size, this.humanPlayer, isQuantum, pieceQueues);
            if (blockMove !== -1) return blockMove;

            // 3. Prefer center if available
            const center = Math.floor((size * size) / 2);
            if (availableMoves.includes(center) && Math.random() < 0.7) {
                return center;
            }

            // 4. Otherwise pick strategic corners or random
            const corners = [0, size - 1, size * (size - 1), size * size - 1].filter(idx => availableMoves.includes(idx));
            if (corners.length > 0 && Math.random() < 0.6) {
                return corners[Math.floor(Math.random() * corners.length)];
            }

            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }

        // Grandmaster (Hard - Unbeatable for 3x3 Classic, Deep Heuristic for 4x4/5x5/Quantum)
        if (size === 3 && !isQuantum) {
            return this._minimaxBestMove(board);
        } else {
            return this._heuristicBestMove(board, size, isQuantum, pieceQueues);
        }
    }

    _getAvailableMoves(board) {
        const moves = [];
        for (let i = 0; i < board.length; i++) {
            if (!board[i]) moves.push(i);
        }
        return moves;
    }

    _findImmediateWin(board, size, player, isQuantum, pieceQueues) {
        const moves = this._getAvailableMoves(board);
        const winLines = this.getWinningCombinations(size);

        for (let move of moves) {
            const simulatedBoard = [...board];
            simulatedBoard[move] = player;

            if (isQuantum && pieceQueues[player].length >= 3) {
                const oldest = pieceQueues[player][0];
                simulatedBoard[oldest] = null;
            }

            if (this.checkWinForBoard(simulatedBoard, winLines, player)) {
                return move;
            }
        }
        return -1;
    }

    /**
     * Perfect Minimax Algorithm for 3x3 Classic
     */
    _minimaxBestMove(board) {
        let bestScore = -Infinity;
        let bestMove = -1;
        const availableMoves = this._getAvailableMoves(board);
        const winLines = this.getWinningCombinations(3);

        // If it's the very first move of the board, take center or corner for instant response
        if (availableMoves.length === 9) return 4;
        if (availableMoves.length === 8 && availableMoves.includes(4)) return 4;

        for (let move of availableMoves) {
            board[move] = this.aiPlayer;
            const score = this._minimax(board, 0, false, -Infinity, Infinity, winLines);
            board[move] = null;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        return bestMove !== -1 ? bestMove : availableMoves[0];
    }

    _minimax(board, depth, isMaximizing, alpha, beta, winLines) {
        const winner = this.getBoardWinner(board, winLines);
        if (winner === this.aiPlayer) return 10 - depth;
        if (winner === this.humanPlayer) return depth - 10;
        if (this._getAvailableMoves(board).length === 0) return 0;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of this._getAvailableMoves(board)) {
                board[move] = this.aiPlayer;
                const evaluation = this._minimax(board, depth + 1, false, alpha, beta, winLines);
                board[move] = null;
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of this._getAvailableMoves(board)) {
                board[move] = this.humanPlayer;
                const evaluation = this._minimax(board, depth + 1, true, alpha, beta, winLines);
                board[move] = null;
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    /**
     * High Performance Heuristic / Depth-Limited Search for 4x4, 5x5 and Quantum
     */
    _heuristicBestMove(board, size, isQuantum, pieceQueues) {
        const winLines = this.getWinningCombinations(size);
        const availableMoves = this._getAvailableMoves(board);

        // 1. Check direct winning move
        const winMove = this._findImmediateWin(board, size, this.aiPlayer, isQuantum, pieceQueues);
        if (winMove !== -1) return winMove;

        // 2. Check direct block move
        const blockMove = this._findImmediateWin(board, size, this.humanPlayer, isQuantum, pieceQueues);
        if (blockMove !== -1) return blockMove;

        // 3. Evaluate each candidate move with strategic positional scoring
        let bestScore = -Infinity;
        let bestMove = availableMoves[0];
        const center = (size - 1) / 2;

        for (let move of availableMoves) {
            let score = 0;
            const r = Math.floor(move / size);
            const c = move % size;

            // Center proximity bonus
            const distFromCenter = Math.hypot(r - center, c - center);
            score += (size - distFromCenter) * 3;

            // Line synergy score
            for (let line of winLines) {
                if (line.includes(move)) {
                    let aiCount = 0;
                    let humanCount = 0;
                    for (let idx of line) {
                        if (board[idx] === this.aiPlayer) aiCount++;
                        if (board[idx] === this.humanPlayer) humanCount++;
                    }

                    if (aiCount > 0 && humanCount === 0) {
                        score += Math.pow(4, aiCount + 1);
                    }
                    if (humanCount > 0 && aiCount === 0) {
                        score += Math.pow(3.5, humanCount);
                    }
                }
            }

            // Slight randomness to prevent robotic repetitive plays
            score += Math.random() * 0.8;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    getBoardWinner(board, winLines) {
        for (let line of winLines) {
            const first = board[line[0]];
            if (first && line.every(idx => board[idx] === first)) {
                return first;
            }
        }
        return null;
    }

    checkWinForBoard(board, winLines, player) {
        for (let line of winLines) {
            if (line.every(idx => board[idx] === player)) {
                return true;
            }
        }
        return false;
    }

    getWinningCombinations(size) {
        const lines = [];

        // Rows
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                row.push(r * size + c);
            }
            lines.push(row);
        }

        // Columns
        for (let c = 0; c < size; c++) {
            const col = [];
            for (let r = 0; r < size; r++) {
                col.push(r * size + c);
            }
            lines.push(col);
        }

        // Main Diagonal
        const diag1 = [];
        for (let i = 0; i < size; i++) {
            diag1.push(i * size + i);
        }
        lines.push(diag1);

        // Anti-Diagonal
        const diag2 = [];
        for (let i = 0; i < size; i++) {
            diag2.push(i * size + (size - 1 - i));
        }
        lines.push(diag2);

        return lines;
    }
}

// Global instance export
window.xoxAI = new XoxAI();
