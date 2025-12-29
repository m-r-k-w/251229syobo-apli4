const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

class VoiceTyper {
    constructor() {
        this.timeLimit = 15;
        this.difficulty = 'normal';
        this.timeLeft = 15;
        this.stat = {
            correct: 0,
            incorrect: 0,
            total: 0
        };
        this.gameState = 'start'; // 'start', 'ready', 'playing', 'result'
        this.timerInterval = null;
        this.letterTimerTimeout = null;

        // Difficulty settings (seconds until letter disappears)
        this.diffSettings = {
            easy: 3.5,
            normal: 2.0,
            hard: 1.0,
            expert: 0.4 // Very fast
        };

        // Audio Context for Sound Effects
        this.audioCtx = null;

        // DOM Elements
        this.screens = {
            start: document.getElementById('start-screen'),
            game: document.getElementById('game-screen'),
            result: document.getElementById('result-screen')
        };

        this.initEventListeners();
    }

    initEventListeners() {
        // Toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.onclick = (e) => {
                const parent = e.target.parentElement;
                parent.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                if (parent.id === 'time-options') {
                    this.timeLimit = parseInt(e.target.dataset.value);
                } else {
                    this.difficulty = e.target.dataset.value;
                }
            };
        });

        // Start button
        document.getElementById('start-btn').onclick = () => this.prepareGame();
        document.getElementById('restart-btn').onclick = () => this.showScreen('start');

        // Global input handler
        window.onkeydown = (e) => this.inputHandler(e);
    }

    inputHandler(e) {
        if (this.gameState === 'ready' && e.code === 'Space') {
            e.preventDefault();
            this.startGame();
        } else if (this.gameState === 'playing') {
            this.handleTyping(e);
        }
    }

    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playSound(type) {
        if (!this.audioCtx) return;
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        if (type === 'correct') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
            oscillator.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(this.audioCtx.currentTime + 0.2);
        } else if (type === 'wrong') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, this.audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(this.audioCtx.currentTime + 0.3);
        }
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.add('hidden'));
        this.screens[screenName].classList.remove('hidden');
    }

    prepareGame() {
        this.initAudio();
        this.gameState = 'ready';
        this.showScreen('game');

        const wordEl = document.getElementById('target-word');
        wordEl.innerHTML = `<span class="ready-text">PRESS SPACE</span>`;
        document.getElementById('timer').innerText = this.timeLimit > 0 ? this.timeLimit.toFixed(1) : "∞";
        document.getElementById('score').innerText = "0 / 0";

        this.speak("Prepare for mission. Press space to begin.", 'en-US');
    }

    startGame() {
        this.stat = { correct: 0, incorrect: 0, total: 0 };
        this.timeLeft = this.timeLimit;
        this.gameState = 'playing';

        this.updateStats();
        this.nextLetter();

        if (this.timeLimit > 0) {
            this.startTimer();
        }

        this.speak("Mission Started", 'en-US');
    }

    startTimer() {
        clearInterval(this.timerInterval);
        const startTime = Date.now();
        const duration = this.timeLimit * 1000;

        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            this.timeLeft = Math.max(0, (duration - elapsed) / 1000);
            document.getElementById('timer').innerText = this.timeLeft.toFixed(1);

            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 100);
    }

    nextLetter() {
        if (this.gameState !== 'playing') return;

        this.currentLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        this.renderLetter();
        this.resetLetterTimer();
        this.updateStats();
    }

    resetLetterTimer() {
        const bar = document.getElementById('letter-timer-bar');
        bar.style.transition = 'none';
        bar.style.width = '100%';
        bar.style.backgroundColor = 'var(--accent-pink)';

        // Force reflow
        bar.offsetHeight;

        const limit = this.diffSettings[this.difficulty];
        bar.style.transition = `width ${limit}s linear`;
        bar.style.width = '0%';

        clearTimeout(this.letterTimerTimeout);
        this.letterTimerTimeout = setTimeout(() => {
            if (this.gameState === 'playing') {
                this.stat.total++;
                this.stat.incorrect++;
                this.playSound('wrong');
                this.updateStats();
                this.nextLetter();
            }
        }, limit * 1000);
    }

    renderLetter() {
        const wordEl = document.getElementById('target-word');
        wordEl.innerHTML = `<span>${this.currentLetter}</span>`;
        wordEl.classList.remove('wrong');
    }

    handleTyping(e) {
        if (this.gameState !== 'playing') return;
        if (e.key === 'Escape') this.endGame();
        if (e.key.length !== 1) return;

        const char = e.key.toUpperCase();
        this.speak(char, 'en-US');

        if (char === this.currentLetter) {
            this.playSound('correct');
            this.stat.correct++;
            this.stat.total++;
            this.updateStats();
            this.nextLetter();
        } else {
            this.playSound('wrong');
            // Incorrect press counts as a total attempt immediately only if we want, 
            // but usually in these games you can keep trying until timeout or next.
            // Based on user: "いくつ正解したかを正解点数にしてください"
            // Let's count wrong press as an immediate fail to move to next letter?
            // "出題数分の正解数が分かる" とのことなので、1ミス=1出題終了とするのが分かりやすい
            this.stat.total++;
            this.stat.incorrect++;
            this.updateStats();

            const wordEl = document.getElementById('target-word');
            wordEl.classList.add('wrong');
            setTimeout(() => {
                wordEl.classList.remove('wrong');
                this.nextLetter();
            }, 200);
        }
    }

    updateStats() {
        document.getElementById('score').innerText = `${this.stat.correct} / ${this.stat.total}`;
    }

    speak(text, lang) {
        window.speechSynthesis.cancel();
        const uttr = new SpeechSynthesisUtterance(text);
        uttr.lang = lang;
        uttr.rate = 2.0;
        window.speechSynthesis.speak(uttr);
    }

    endGame() {
        this.gameState = 'result';
        clearInterval(this.timerInterval);
        clearTimeout(this.letterTimerTimeout);

        this.showScreen('result');
        document.getElementById('final-score').innerText = `${this.stat.correct} / ${this.stat.total}`;

        const acc = this.stat.total > 0 ? Math.round((this.stat.correct / this.stat.total) * 100) : 0;
        document.getElementById('accuracy').innerText = `${acc}%`;

        document.getElementById('wpm').innerText = this.difficulty.toUpperCase();

        this.speak("Mission Complete", 'en-US');
    }
}

window.onload = () => {
    new VoiceTyper();
};
