// find_ori.js - Instance Mode with Score Saving

window.sketchFindMimic = function(p) {

    // --- Game Configuration ---
    const GAME_ID = 'find';
    const ASPECT_RATIO = 9 / 16;
    const NUM_ENEMIES = 15;
    const TARGET_SCORE = 5;
    const TIME_PER_MIMIC = 15000; // ms
    const ENEMY_MIN_SPEED = 0.8;
    const ENEMY_MAX_SPEED = 2.0;
    const ENEMY_BASE_SCALE = 0.35;
    const PROJECTILE_SPEED = 10;
    const MIMIC_VARIATIONS = { TINT: 'tint', FLIP: 'flip' };

    // --- Asset Paths ---
    const ENEMY_IMG_PATH = 'src/images/enemy1.gif';
    const TOY_IMG_PATH = 'src/images/chicken_toy.jpg';
    const HIT_SND_PATH = 'src/sounds/caw.mp3';

    // --- Sketch-Scoped Variables ---
    let enemyImg, toyImg, hitSnd;
    let enemies = [];
    let mimicIndex = -1;
    let currentMimicVariation = null;
    let gameState = 'loading'; // 'loading', 'start', 'playing', 'levelComplete', 'gameOver', 'win'
    let score = 0;
    let scoreSaved = false; // <<< ADDED: Flag to prevent multiple score saves
    let timeLeft = TIME_PER_MIMIC;
    let levelCompleteTimer = 0;
    const LEVEL_COMPLETE_DURATION = 1500; // ms

    let projectile = { active: false, x: 0, y: 0, targetX: 0, targetY: 0, img: null };
    let startButton;
    let canvasWidth, canvasHeight;

    p.preload = function() {
        console.log("FindMimic: Preloading assets...");
        try {
            enemyImg = p.loadImage(ENEMY_IMG_PATH);
            toyImg = p.loadImage(TOY_IMG_PATH);
            p.soundFormats('mp3', 'ogg');
            hitSnd = p.loadSound(HIT_SND_PATH);
            projectile.img = toyImg;
        } catch (e) {
            console.error("FindMimic: Error initiating asset loading.", e);
            gameState = 'error';
        }
    }

    p.setup = function() {
        console.log("FindMimic: Setup started.");
        if (p.windowWidth / p.windowHeight > ASPECT_RATIO) {
            canvasHeight = p.windowHeight;
            canvasWidth = p.windowHeight * ASPECT_RATIO;
        } else {
            canvasWidth = p.windowWidth;
            canvasHeight = p.windowWidth / ASPECT_RATIO;
        }
        p.createCanvas(canvasWidth, canvasHeight);
        p.pixelDensity(1);

        if (!enemyImg || !enemyImg.width || !toyImg || !toyImg.width || !hitSnd) {
            console.error("FindMimic: Essential assets failed to load properly.");
            gameState = 'error';
            p.background(50,0,0); p.fill(255, 100, 100); p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
            p.text("Error loading game assets. Check console.", p.width/2, p.height/2);
            p.noLoop(); return;
        }

        p.textAlign(p.CENTER, p.CENTER);
        p.textFont('Arial');
        p.imageMode(p.CENTER);

        startButton = p.createButton('미메시스 찾기 시작!');
        startButton.position(p.width / 2 - startButton.elt.offsetWidth / 2, p.height * 0.6);
        startButton.mousePressed(startGame);
        startButton.style('padding', '12px 25px');
        startButton.style('font-size', '18px');
        startButton.style('cursor', 'pointer');
        startButton.id('gameStartButton');

        gameState = 'start';
    }

    p.draw = function() {
        p.background(230, 240, 255);
        switch (gameState) {
            case 'start': displayStartScreen(); break;
            case 'playing': runPlayingState(); break;
            case 'levelComplete': runLevelCompleteState(); break;
            case 'gameOver':
            case 'win':
            case 'error':
                displayEndScreen();
                break;
        }
        if (projectile.active && gameState !== 'start' && gameState !== 'error') {
            drawProjectile();
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
            startButton.position(p.width / 2 - startButton.elt.offsetWidth / 2, p.height * 0.6);
        }
    }

    p.cleanup = function() {
        console.log("FindMimic: p.cleanup() called.");
        if (hitSnd && hitSnd.isPlaying()) { hitSnd.stop(); }
        enemies = [];
        projectile.active = false;
        scoreSaved = false; // <<< MODIFIED: Reset flag
    }

    p.mousePressed = function() { handleInput(p.mouseX, p.mouseY); }
    p.touchStarted = function() {
        if (p.touches.length > 0) { handleInput(p.touches[0].x, p.touches[0].y); return false; }
    }

    function handleInput(x, y) {
        if (gameState !== 'playing') return;
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            if (!enemy) continue;
            let enemyRadius = (enemy.baseWidth * enemy.currentScale) / 2;
            let distSq = (x - enemy.x) * (x - enemy.x) + (y - enemy.y) * (y - enemy.y);
            if (distSq < enemyRadius * enemyRadius) {
                if (i === mimicIndex) {
                    score++;
                    if (hitSnd && hitSnd.isLoaded()) { hitSnd.play(); }
                    projectile.active = true;
                    projectile.x = x;
                    projectile.y = y;
                    projectile.targetX = enemy.x;
                    projectile.targetY = enemy.y;
                    gameState = 'levelComplete';
                    levelCompleteTimer = p.millis();
                }
                break;
            }
        }
    }

    function startGame() {
        if (startButton) startButton.hide();
        score = 0;
        scoreSaved = false; // <<< MODIFIED: Reset flag on start
        initializeLevel();
        gameState = 'playing';
    }

    function runPlayingState() {
        timeLeft -= p.deltaTime;
        if (timeLeft <= 0) {
            gameState = 'gameOver';
            timeLeft = 0;
            return;
        }
        updateEnemies();
        updateProjectile();
        drawEnemies();
        drawUI();
    }

    function runLevelCompleteState() {
        drawEnemies();
        p.fill(0, 150, 0, 200);
        p.rect(0, 0, p.width, p.height);
        p.fill(255);
        p.textSize(40);
        p.text("찾았다!", p.width / 2, p.height / 2 - 30);
        p.textSize(30);
        p.text(`점수: ${score}`, p.width / 2, p.height / 2 + 20);
        if (p.millis() - levelCompleteTimer > LEVEL_COMPLETE_DURATION) {
            if (score >= TARGET_SCORE) {
                gameState = 'win';
            } else {
                initializeLevel();
                gameState = 'playing';
            }
            projectile.active = false;
        }
    }

    function initializeLevel() {
        timeLeft = TIME_PER_MIMIC;
        enemies = [];
        projectile.active = false;
        mimicIndex = p.floor(p.random(NUM_ENEMIES));
        let variationKeys = Object.keys(MIMIC_VARIATIONS);
        currentMimicVariation = MIMIC_VARIATIONS[p.random(variationKeys)];
        for (let i = 0; i < NUM_ENEMIES; i++) {
            enemies.push(createEnemy(i === mimicIndex));
        }
    }

    function createEnemy(isMimic = false) {
        const baseW = enemyImg.width * ENEMY_BASE_SCALE;
        const baseH = enemyImg.height * ENEMY_BASE_SCALE;
        const startMargin = baseW;
        let x = p.random(startMargin, p.width - startMargin);
        let y = p.random(startMargin, p.height - startMargin);
        let speed = p.random(ENEMY_MIN_SPEED, ENEMY_MAX_SPEED);
        let vx = (p.random() > 0.5 ? 1 : -1) * speed;
        return { img: enemyImg, x, y, vx, vy: 0, baseWidth: baseW, baseHeight: baseH, currentScale: 1.0, isMimic, variation: isMimic ? currentMimicVariation : null };
    }

    function updateEnemies() {
        for (let enemy of enemies) {
            enemy.x += enemy.vx;
            let halfWidth = (enemy.baseWidth * enemy.currentScale) / 2;
            if (enemy.x + halfWidth > p.width || enemy.x - halfWidth < 0) {
                enemy.vx *= -1;
                enemy.x = p.constrain(enemy.x, halfWidth, p.width - halfWidth);
            }
        }
    }

    function updateProjectile() {
        if (!projectile.active) return;
        let dx = projectile.targetX - projectile.x;
        let dy = projectile.targetY - projectile.y;
        let distance = p.sqrt(dx * dx + dy * dy);
        if (distance < PROJECTILE_SPEED) {
            projectile.active = false;
        } else {
            projectile.x += (dx / distance) * PROJECTILE_SPEED;
            projectile.y += (dy / distance) * PROJECTILE_SPEED;
        }
    }

    function drawEnemies() {
        p.imageMode(p.CENTER);
        for (let enemy of enemies) {
            if (!enemy || !enemy.img || !enemy.img.width) continue;
            p.push();
            p.translate(enemy.x, enemy.y);
            let flip = (enemy.vx >= 0) ? 1 : -1;
            if (enemy.isMimic) {
                if (enemy.variation === MIMIC_VARIATIONS.TINT) p.tint(255, 150, 150, 230);
                if (enemy.variation === MIMIC_VARIATIONS.FLIP) flip *= -1;
            }
            p.scale(flip, 1);
            p.image(enemy.img, 0, 0, enemy.baseWidth, enemy.baseHeight);
            if (enemy.isMimic && enemy.variation === MIMIC_VARIATIONS.TINT) p.noTint();
            p.pop();
        }
    }

    function drawProjectile() {
        if (!projectile.active || !projectile.img) return;
        p.image(projectile.img, projectile.x, projectile.y, projectile.img.width * 0.15, projectile.img.height * 0.15);
    }

    function drawUI() {
        p.fill(0); p.textSize(24); p.textAlign(p.LEFT, p.TOP);
        p.text(`점수: ${score} / ${TARGET_SCORE}`, 20, 20);
        p.textAlign(p.RIGHT, p.TOP);
        let displayTime = p.ceil(timeLeft / 1000);
        p.fill(displayTime <= 5 ? p.color(200, 0, 0) : 0);
        p.textSize(30);
        p.text(`시간: ${displayTime}`, p.width - 20, 15);
    }

    function displayStartScreen() {
        p.background(200, 210, 230);
        p.fill(50); p.textSize(32); p.textAlign(p.CENTER, p.CENTER);
        p.text("미메시스를 찾아라!", p.width / 2, p.height * 0.3);
        p.textSize(18);
        p.text(`마구 돌아다니는 캐릭터 중,\n살짝 다른 하나 (${TARGET_SCORE}마리)를 시간 안에 찾아 클릭하세요!`, p.width / 2, p.height * 0.45);
        if (startButton && startButton.elt && startButton.elt.style.display === 'none') {
            startButton.show();
            p.windowResized();
        }
    }

    function displayEndScreen() {
        // <<< MODIFIED: Save score on game end >>>
        if (!scoreSaved) {
            window.saveScore(GAME_ID, score);
            scoreSaved = true;
            console.log(`Find Mimesis Game: Saved score of ${score}`);
        }

        let message = "", subMessage = "", bgColor = p.color(100, 100, 100, 220);
        if (gameState === 'win') {
            message = "승리!";
            subMessage = `축하합니다! ${TARGET_SCORE}마리의 미메시스를 모두 찾았습니다!`;
            bgColor = p.color(150, 255, 150, 220);
        } else if (gameState === 'gameOver') {
            message = "게임 오버";
            subMessage = `시간 초과! 최종 점수: ${score}`;
            bgColor = p.color(255, 150, 150, 220);
        } else if (gameState === 'error') {
            message = "오류 발생";
            subMessage = "게임 에셋 로딩 실패. 콘솔을 확인하세요.";
            bgColor = p.color(100, 100, 0, 220);
        }

        p.fill(bgColor);
        p.rect(0, 0, p.width, p.height);
        p.fill(0);
        p.textSize(50); p.textAlign(p.CENTER, p.CENTER);
        p.text(message, p.width / 2, p.height / 2 - 40);
        p.textSize(22);
        p.text(subMessage, p.width / 2, p.height / 2 + 20);
        p.textSize(18);
        p.text("페이지를 새로고침하여 다시 플레이하세요.", p.width / 2, p.height / 2 + 70);
        p.noLoop();
    }
};
