// shout_game.js - Instance Mode with Score Saving

window.sketchShoutGame = function(p) {

    // --- Game Configuration (Constants) ---
    const ASPECT_RATIO = 9 / 16;
    const NUM_ENEMY1 = 10;
    const NUM_ENEMY2 = 1;
    const LOUDNESS_THRESHOLD = 0.1;
    const WIN_SCORE = 3;
    const ACTION_STATE_DURATION = 3000; // ms
    const MIN_INTERVAL = 3000; // ms
    const MAX_INTERVAL = 10000; // ms
    const ENEMY_MAX_SCALE = 3.0;
    const TEXT_UPDATE_INTERVAL = 500; // ms
    const NOISE_COOLDOWN = 500; // ms
    const ENEMY_MIN_SPEED = 0.5;
    const ENEMY_MAX_SPEED = 1.5;
    const GAME_ID = 'shout'; // For saving scores

    // --- Sketch-Scoped Variables ---
    let mic;
    let enemy1Img, enemy2Img;
    let enemies = [];
    let gameState = 'start'; // 'start', 'playing', 'gameOver', 'win', 'no_mic'
    let score = 0;
    let startButton;
    let canvasWidth, canvasHeight;
    let scoreSaved = false; // <<< ADDED: Flag to prevent multiple score saves

    // State Management
    let isActionState = false;
    let actionStateTimer = 0;
    let nextActionIntervalTimer = 0;
    let targetEnemyIndex = -1;
    let lastEnemy1TargetIndex = -1;
    let gameOverReason = '';
    let lastShoutTimestamp = 0;

    // Text Animation
    let shoutTextSize = 30;
    let shoutTextSizeTarget = 60;
    let currentShoutTextSize = shoutTextSize;
    let shoutTextColor;
    let lastTextUpdateTime = 0;

    p.preload = function() {
        try {
            enemy1Img = p.loadImage('src/images/enemy1.gif');
            enemy2Img = p.loadImage('src/images/enemy2.gif');
        } catch (e) {
            console.error("Error loading images.", e);
        }
    }

    p.setup = function() {
        if (p.windowWidth / p.windowHeight > ASPECT_RATIO) {
            canvasHeight = p.windowHeight;
            canvasWidth = p.windowHeight * ASPECT_RATIO;
        } else {
            canvasWidth = p.windowWidth;
            canvasHeight = p.windowWidth / ASPECT_RATIO;
        }
        p.createCanvas(canvasWidth, canvasHeight);
        p.pixelDensity(1);

        if (!enemy2Img || !enemy2Img.width) {
            console.error("Enemy 2 image failed to load. Game cannot proceed.");
            p.noLoop();
            p.background(0);
            p.fill(255, 0, 0);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(20);
            p.text("Error: Could not load critical game image!", p.width / 2, p.height / 2);
            return;
        }

        initializeEnemies();
        startButton = p.createButton('Start Game');
        startButton.position(p.width / 2 - startButton.elt.offsetWidth / 2, p.height / 2);
        startButton.mousePressed(startGame);
        startButton.style('padding', '10px 20px');
        startButton.style('font-size', '18px');
        startButton.style('cursor', 'pointer');
        startButton.id('gameStartButton');

        p.textAlign(p.CENTER, p.CENTER);
        p.textFont('Arial');
        nextActionIntervalTimer = p.random(MIN_INTERVAL, MAX_INTERVAL);
        shoutTextColor = getRandomRedColor();
    }

    p.draw = function() {
        p.background(0);
        switch (gameState) {
            case 'start':
                displayStartScreen();
                break;
            case 'playing':
                runGameLogic();
                displayGameScreen();
                break;
            case 'gameOver':
                displayGameOverScreen();
                break;
            case 'win':
                displayWinScreen();
                break;
            case 'no_mic':
                displayMicErrorScreen();
                break;
        }
    }

    p.windowResized = function() {
        if (p.windowWidth / p.windowHeight > ASPECT_RATIO) {
            canvasHeight = p.windowHeight;
            canvasWidth = p.windowHeight * ASPECT_RATIO;
        } else {
            canvasWidth = p.windowWidth;
            canvasHeight = p.windowWidth / ASPECT_RATIO;
        }
        p.resizeCanvas(canvasWidth, canvasHeight);
        if (startButton && startButton.elt && startButton.elt.style.display !== 'none' && gameState === 'start') {
            startButton.position(p.width / 2 - startButton.elt.offsetWidth / 2, p.height / 2);
        }
    }

    p.cleanup = function() {
        console.log("p.cleanup(): Cleaning up shout_game resources...");
        if (mic && typeof mic.stop === 'function' && mic.enabled) {
            try {
                mic.stop();
                console.log("p.cleanup(): Microphone stopped.");
            } catch(e) {
                console.error("p.cleanup(): Error stopping microphone -", e);
            }
        }
        enemies = [];
        gameState = 'start';
        score = 0;
        scoreSaved = false; // Reset flag on cleanup
    }

    function startGame() {
        mic = new p5.AudioIn();
        mic.start(() => {
            console.log("Microphone access granted.");
            gameState = 'playing';
            startButton.hide();
            initializeEnemies();
            score = 0;
            scoreSaved = false; // <<< MODIFIED: Reset score saved flag
            isActionState = false;
            actionStateTimer = 0;
            targetEnemyIndex = -1;
            lastEnemy1TargetIndex = -1;
            lastShoutTimestamp = 0;
            nextActionIntervalTimer = p.random(MIN_INTERVAL, MAX_INTERVAL);
        }, (err) => {
            console.error("Microphone access denied.", err);
            gameState = 'no_mic';
            startButton.hide();
        });

        if (p.getAudioContext().state !== 'running') {
            p.userStartAudio();
        }
    }

    function runGameLogic() {
        let currentTime = p.millis();
        let dt = p.deltaTime;

        if (mic && mic.enabled) {
            let level = mic.getLevel();
            if (level > LOUDNESS_THRESHOLD && currentTime - lastShoutTimestamp > NOISE_COOLDOWN) {
                lastShoutTimestamp = currentTime;
                if (isActionState) {
                    score++;
                    isActionState = false;
                    actionStateTimer = 0;
                    if (targetEnemyIndex !== -1 && enemies[targetEnemyIndex]) {
                        enemies[targetEnemyIndex].isTarget = false;
                        enemies[targetEnemyIndex].currentScale = 1.0;
                    }
                    targetEnemyIndex = -1;
                    nextActionIntervalTimer = p.random(MIN_INTERVAL, MAX_INTERVAL);
                    if (score >= WIN_SCORE) {
                        // --- SCORE SAVE ON WIN ---
                        if (!scoreSaved) {
                            window.saveScore(GAME_ID, score);
                            scoreSaved = true;
                        }
                        gameState = 'win';
                        if (mic) mic.stop();
                    }
                } else {
                    // --- SCORE SAVE ON LOSS (NOISE) ---
                    if (!scoreSaved) {
                        window.saveScore(GAME_ID, score);
                        scoreSaved = true;
                    }
                    gameOverReason = 'noise';
                    gameState = 'gameOver';
                    lastEnemy1TargetIndex = pickRandomEnemyOfType(1, true);
                    if (mic) mic.stop();
                }
            }
        } else if (gameState === 'playing') {
            gameState = 'no_mic';
            if (mic) mic.stop();
        }

        if (isActionState) {
            actionStateTimer -= dt;
            if (actionStateTimer <= 0) {
                // --- SCORE SAVE ON LOSS (TIMEOUT) ---
                if (!scoreSaved) {
                    window.saveScore(GAME_ID, score);
                    scoreSaved = true;
                }
                gameOverReason = 'timeout';
                gameState = 'gameOver';
                isActionState = false;
                if (targetEnemyIndex !== -1 && enemies[targetEnemyIndex]) {
                    enemies[targetEnemyIndex].isTarget = false;
                }
                if (mic) mic.stop();
            }
        } else {
            if (gameState === 'playing') {
                nextActionIntervalTimer -= dt;
                if (nextActionIntervalTimer <= 0) {
                    startActionState();
                }
            }
        }

        if (gameState === 'playing') {
            updateEnemies(dt);
        }

        if (isActionState && gameState === 'playing') {
            updateShoutTextAnimation(currentTime);
        }
    }

    function displayStartScreen() {
        p.background(20, 20, 20);
        p.fill(220);
        p.textSize(30);
        p.textFont('Verdana');
        p.text("Shout/Silence Challenge", p.width / 2, p.height * 0.25);
        p.fill(180);
        p.textSize(16);
        p.textFont('Arial');
        let lineY = p.height * 0.35;
        const lineHeight = 28;
        p.text("Click 'Start Game' & Allow Microphone.", p.width / 2, lineY); lineY += lineHeight;
        p.text("Stay quiet when text shows 'SHHH....'", p.width / 2, lineY); lineY += lineHeight;
        p.text("When the LARGE enemy appears and text flashes 'Shout!!',", p.width / 2, lineY); lineY += lineHeight;
        p.text("SHOUT LOUDLY within 3 seconds!", p.width / 2, lineY); lineY += lineHeight + 5;
        p.text(`Reach ${WIN_SCORE} points to win.`, p.width / 2, lineY);
        if (startButton && startButton.elt && startButton.elt.style.display === 'none') {
            startButton.show();
            p.windowResized();
        }
    }

    function displayGameScreen() {
        drawEnemies();
        p.fill(255);
        p.textSize(24);
        p.textAlign(p.LEFT, p.TOP);
        p.text(`Score: ${score}`, 15, 15);
        p.textAlign(p.CENTER, p.CENTER);
        if (isActionState) {
            p.textSize(currentShoutTextSize);
            p.fill(shoutTextColor);
            p.text("Shout!!", p.width / 2, p.height / 2);
        } else {
            p.textSize(40);
            p.fill(200, 200, 255, 180);
            p.text("SHHH....", p.width / 2, p.height / 2);
        }
    }

    function displayGameOverScreen() {
        p.background(80, 0, 0, 200);
        drawEnemies(true);
        p.fill(0, 0, 0, 150);
        p.rect(0, p.height * 0.25, p.width, p.height * 0.5);
        p.fill(255, 0, 0);
        p.textSize(60);
        p.textFont('Impact');
        p.text("GAME OVER", p.width / 2, p.height * 0.35);
        p.fill(255);
        p.textFont('Arial');
        p.textSize(24);
        let message = gameOverReason === 'timeout' ? "You didn't shout in time!" : "Shouted at the wrong time!";
        p.text(message, p.width / 2, p.height * 0.5);
        p.textSize(20);
        p.text(`Final Score: ${score}`, p.width / 2, p.height * 0.5 + 50);
        p.text("Refresh or choose another game.", p.width / 2, p.height * 0.65);
        p.noLoop();
    }

    function displayWinScreen() {
        p.background(0, 80, 0, 200);
        drawEnemies(true);
        p.fill(0, 0, 0, 150);
        p.rect(0, p.height * 0.25, p.width, p.height * 0.5);
        p.fill(0, 255, 0);
        p.textSize(60);
        p.textFont('Impact');
        p.text("YOU WIN!", p.width / 2, p.height * 0.35);
        p.fill(255);
        p.textFont('Arial');
        p.textSize(24);
        p.text(`You reached ${score} points! Well done!`, p.width / 2, p.height * 0.5);
        p.text("Refresh or choose another game.", p.width / 2, p.height * 0.65);
        p.noLoop();
    }

    function displayMicErrorScreen() {
        p.background(50, 50, 0);
        p.fill(255, 255, 0);
        p.textSize(30);
        p.textAlign(p.CENTER, p.CENTER);
        p.text("Microphone Error", p.width / 2, p.height / 3);
        p.fill(255);
        p.textSize(18);
        p.text("Could not access the microphone.", p.width / 2, p.height / 2);
        p.text("Please check browser permissions and refresh.", p.width / 2, p.height / 2 + 30);
        p.noLoop();
    }

    function initializeEnemies() {
        enemies = [];
        const scaleFactorEnemy1 = 0.25;
        const scaleFactorEnemy2 = 0.5;
        if (enemy1Img && enemy1Img.width > 0) {
            const baseW = enemy1Img.width * scaleFactorEnemy1;
            const baseH = enemy1Img.height * scaleFactorEnemy1;
            for (let i = 0; i < NUM_ENEMY1; i++) {
                enemies.push({ type: 1, img: enemy1Img, x: p.random(baseW / 2, p.width - baseW / 2), y: p.random(baseH / 2, p.height - baseH / 2), vx: (p.random() > 0.5 ? 1 : -1) * p.random(ENEMY_MIN_SPEED, ENEMY_MAX_SPEED), vy: 0, baseWidth: baseW, baseHeight: baseH, currentScale: 1.0, isTarget: false });
            }
        }
        if (enemy2Img && enemy2Img.width > 0) {
            const baseW = enemy2Img.width * scaleFactorEnemy2;
            const baseH = enemy2Img.height * scaleFactorEnemy2;
            enemies.push({ type: 2, img: enemy2Img, x: p.random(baseW / 2, p.width - baseW / 2), y: p.random(baseH / 2, p.height - baseH / 2), vx: -1 * p.random(ENEMY_MIN_SPEED, ENEMY_MAX_SPEED), vy: 0, baseWidth: baseW, baseHeight: baseH, currentScale: 1.0, isTarget: false });
        }
    }

    function updateEnemies(dt) {
        for (let enemy of enemies) {
            enemy.x += enemy.vx;
            let halfWidth = (enemy.baseWidth * enemy.currentScale) / 2;
            if (enemy.x + halfWidth > p.width || enemy.x - halfWidth < 0) {
                enemy.vx *= -1;
                enemy.x = p.constrain(enemy.x, halfWidth, p.width - halfWidth);
            }
            if (isActionState && enemy.isTarget) {
                let progress = 1.0 - p.constrain(actionStateTimer / ACTION_STATE_DURATION, 0, 1);
                enemy.currentScale = p.lerp(1.0, ENEMY_MAX_SCALE, progress);
            } else {
                enemy.currentScale = 1.0;
            }
        }
    }

    function drawEnemies(freeze = false) {
        p.imageMode(p.CENTER);
        for (let enemy of enemies) {
            if (!enemy.img || !enemy.img.width) continue;
            p.push();
            p.translate(enemy.x, enemy.y);
            if (enemy.vx < 0) { p.scale(-1, 1); }
            p.scale(enemy.currentScale);
            p.image(enemy.img, 0, 0, enemy.baseWidth, enemy.baseHeight);
            p.pop();
        }
        p.imageMode(p.CORNER);
    }

    function startActionState() {
        targetEnemyIndex = pickRandomEnemyOfType(2);
        if (targetEnemyIndex !== -1) {
            isActionState = true;
            actionStateTimer = ACTION_STATE_DURATION;
            enemies[targetEnemyIndex].isTarget = true;
            lastTextUpdateTime = p.millis();
            shoutTextColor = getRandomRedColor();
            currentShoutTextSize = shoutTextSize;
        } else {
            nextActionIntervalTimer = 1500;
        }
    }

    function pickRandomEnemyOfType(type, enlargeImmediately = false) {
        let indices = [];
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i] && enemies[i].type === type) {
                indices.push(i);
            }
        }
        if (indices.length > 0) {
            let actualEnemyIndex = p.random(indices);
            if (enlargeImmediately && enemies[actualEnemyIndex]) {
                enemies[actualEnemyIndex].currentScale = ENEMY_MAX_SCALE * 1.5;
                enemies[actualEnemyIndex].isTarget = true;
            }
            return actualEnemyIndex;
        }
        return -1;
    }

    function updateShoutTextAnimation(currentTime) {
        if (currentTime - lastTextUpdateTime > TEXT_UPDATE_INTERVAL) {
            lastTextUpdateTime = currentTime;
            let temp = shoutTextSize;
            shoutTextSize = shoutTextSizeTarget;
            shoutTextSizeTarget = temp;
            shoutTextColor = getRandomRedColor();
        }
        currentShoutTextSize = p.lerp(currentShoutTextSize, shoutTextSize, 0.2);
    }

    function getRandomRedColor() {
        return p.color(p.random(180, 256), p.random(0, 80), p.random(0, 80));
    }
};
