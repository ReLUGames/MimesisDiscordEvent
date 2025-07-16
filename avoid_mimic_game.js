// avoid_mimic_game.js - Instance Mode with Score Saving

window.sketchAvoidMimic = function(p) {

    // --- Game Configuration ---
    const GAME_ID = 'avoid';
    const ASPECT_RATIO = 9 / 16;
    const NUM_LANES = 3;
    const TARGET_SCORE = 20;
    const PLAYER_SCALE = 0.18;
    const MIMIC_SCALE = 0.30;
    const BASE_MIMIC_SPEED = 3;
    const SPEED_INCREASE_PER_POINT = 0.1;
    const BASE_SPAWN_INTERVAL = 3000; // ms
    const MIN_SPAWN_INTERVAL = 400;   // ms
    const SPAWN_INTERVAL_REDUCTION_PER_POINT = 130; // ms

    // --- Asset Paths ---
    const PLAYER_IMG_PATH = 'src/images/tram.png';
    const MIMIC_IMG_PATH = 'src/images/enemy1.gif';
    const BG_IMG_PATH = 'src/images/track_bg.png';
    const CRASH_SND_PATH = 'src/sounds/crash.mp3';
    const SCORE_SND_PATH = 'src/sounds/score.mp3';

    // --- Sketch-Scoped Variables ---
    let playerImg, mimicImg, bgImg, crashSnd, scoreSnd;
    let player;
    let mimics = [];
    let laneCenters = [];
    let laneWidth;

    let score = 0;
    let scoreSaved = false; // <<< ADDED: Flag to prevent multiple score saves
    let gameState = 'loading'; // 'loading', 'start', 'playing', 'gameOver', 'win'
    let spawnTimer = 0;
    let currentSpawnInterval = BASE_SPAWN_INTERVAL;
    let currentMimicSpeed = BASE_MIMIC_SPEED;

    let startButton;
    let canvasWidth, canvasHeight;
    let touchStartX = 0, touchLastX = 0, isTouching = false;

    p.preload = function() {
        console.log("AvoidMimic: Preloading assets...");
        try {
            playerImg = p.loadImage(PLAYER_IMG_PATH);
            mimicImg = p.loadImage(MIMIC_IMG_PATH);
            try { bgImg = p.loadImage(BG_IMG_PATH); } catch(e) { bgImg = null; }
            p.soundFormats('mp3', 'ogg');
            try { crashSnd = p.loadSound(CRASH_SND_PATH); } catch(e) { crashSnd = null; }
            try { scoreSnd = p.loadSound(SCORE_SND_PATH); } catch(e) { scoreSnd = null; }
        } catch (e) {
            console.error("AvoidMimic: Error loading critical assets.", e);
            gameState = 'error';
        }
    }

    p.setup = function() {
        console.log("AvoidMimic: Setup started.");
        if (p.windowWidth / p.windowHeight > ASPECT_RATIO) {
            canvasHeight = p.windowHeight;
            canvasWidth = p.windowHeight * ASPECT_RATIO;
        } else {
            canvasWidth = p.windowWidth;
            canvasHeight = p.windowWidth / ASPECT_RATIO;
        }
        p.createCanvas(canvasWidth, canvasHeight);
        p.pixelDensity(1);

        if (!playerImg || !playerImg.width || !mimicImg || !mimicImg.width) {
            console.error("AvoidMimic: Critical assets failed to load.");
            gameState = 'error';
            p.background(50,0,0); p.fill(255, 100, 100); p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
            p.text("Error loading game assets. Check console.", p.width/2, p.height/2);
            p.noLoop(); return;
        }

        p.textAlign(p.CENTER, p.CENTER);
        p.textFont('Arial');
        p.imageMode(p.CENTER);

        calculateLanes();
        player = { img: playerImg, lane: 1, x: laneCenters[1], y: p.height * 0.85, width: playerImg.width * PLAYER_SCALE, height: playerImg.height * PLAYER_SCALE };

        startButton = p.createButton('미메시스 피하기 시작!');
        startButton.position(p.width / 2 - startButton.elt.offsetWidth / 2, p.height * 0.6);
        startButton.mousePressed(startGame);
        startButton.style('padding', '12px 25px');
        startButton.style('font-size', '18px');
        startButton.style('cursor', 'pointer');
        startButton.id('gameStartButton');

        gameState = 'start';
    }

    p.draw = function() {
        if (bgImg) { p.image(bgImg, p.width / 2, p.height / 2, p.width, p.height); }
        else { p.background(100, 120, 150); }
        drawLanes();

        switch (gameState) {
            case 'start':
                displayStartScreen();
                p.tint(255, 150); drawPlayer(); p.noTint();
                break;
            case 'playing': runPlayingState(); break;
            case 'gameOver':
            case 'win':
            case 'error':
                displayEndScreen();
                if (gameState !== 'error') { drawPlayer(); drawMimics(); }
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
        calculateLanes();
        if (player) { player.x = laneCenters[player.lane]; player.y = p.height * 0.85; }
        if (startButton && startButton.elt && startButton.elt.style.display !== 'none' && gameState === 'start') {
            startButton.position(p.width / 2 - startButton.elt.offsetWidth / 2, p.height * 0.6);
        }
        mimics.forEach(mimic => { mimic.x = laneCenters[mimic.lane]; });
    }

    p.keyPressed = function() {
        if (gameState !== 'playing') return;
        if (p.keyCode === p.LEFT_ARROW) player.lane--;
        else if (p.keyCode === p.RIGHT_ARROW) player.lane++;
        player.lane = p.constrain(player.lane, 0, NUM_LANES - 1);
        player.x = laneCenters[player.lane];
    }
    
    p.touchStarted = function() {
        if (gameState !== 'playing' || p.touches.length === 0) return true;
        touchStartX = p.touches[0].x;
        touchLastX = p.touches[0].x;
        isTouching = true;
        return false;
    }

    p.touchMoved = function() {
        if (gameState !== 'playing' || !isTouching || p.touches.length === 0) return true;
        touchLastX = p.touches[0].x;
        return false;
    }

    p.touchEnded = function() {
        if (gameState !== 'playing' || !isTouching) { isTouching = false; return true; }
        isTouching = false;
        const deltaX = touchLastX - touchStartX;
        if (p.abs(deltaX) > 50) {
            if (deltaX < 0) player.lane--;
            else player.lane++;
            player.lane = p.constrain(player.lane, 0, NUM_LANES - 1);
            player.x = laneCenters[player.lane];
            return false;
        }
        return true;
    }

    p.cleanup = function() {
        console.log("AvoidMimic: p.cleanup() called.");
        if (crashSnd && crashSnd.isPlaying()) crashSnd.stop();
        if (scoreSnd && scoreSnd.isPlaying()) scoreSnd.stop();
        mimics = [];
        scoreSaved = false; // <<< MODIFIED: Reset flag
    }

    function startGame() {
        if (startButton) startButton.hide();
        score = 0;
        scoreSaved = false; // <<< MODIFIED: Reset flag on start
        mimics = [];
        player.lane = 1;
        player.x = laneCenters[player.lane];
        currentSpawnInterval = BASE_SPAWN_INTERVAL;
        currentMimicSpeed = BASE_MIMIC_SPEED;
        spawnTimer = currentSpawnInterval;
        gameState = 'playing';
    }

    function runPlayingState() {
        updateSpawnTimer();
        updateMimics();
        checkCollisions();
        drawPlayer();
        drawMimics();
        drawUI();
    }

    function calculateLanes() {
        laneWidth = p.width / NUM_LANES;
        laneCenters = [];
        for (let i = 0; i < NUM_LANES; i++) {
            laneCenters.push(laneWidth / 2 + i * laneWidth);
        }
    }

    function updateSpawnTimer() {
        spawnTimer -= p.deltaTime;
        if (spawnTimer <= 0) {
            spawnMimic();
            currentSpawnInterval = p.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - score * SPAWN_INTERVAL_REDUCTION_PER_POINT);
            currentMimicSpeed = BASE_MIMIC_SPEED + score * SPEED_INCREASE_PER_POINT;
            spawnTimer = currentSpawnInterval;
        }
    }

    function spawnMimic() {
        const occupiedLanesNearTop = new Set(mimics.filter(m => m.y < p.height * 0.15 && m.y > -m.height).map(m => m.lane));
        const availableLanes = Array.from({ length: NUM_LANES }, (_, i) => i).filter(i => !occupiedLanesNearTop.has(i));
        if (availableLanes.length > 0) {
            let spawnLane = p.random(availableLanes);
            mimics.push({ img: mimicImg, lane: spawnLane, x: laneCenters[spawnLane], y: -mimicImg.height * MIMIC_SCALE / 2, vy: currentMimicSpeed, width: mimicImg.width * MIMIC_SCALE, height: mimicImg.height * MIMIC_SCALE, scored: false });
        }
    }

    function updateMimics() {
        for (let i = mimics.length - 1; i >= 0; i--) {
            let mimic = mimics[i];
            mimic.y += mimic.vy;
            if (!mimic.scored && mimic.y - mimic.height / 2 > p.height) {
                score++;
                mimic.scored = true;
                if (scoreSnd && scoreSnd.isLoaded()) scoreSnd.play();
                mimics.splice(i, 1);
                if (score >= TARGET_SCORE) {
                    gameState = 'win';
                }
            } else if (mimic.scored) {
                mimics.splice(i, 1);
            }
        }
    }

    function checkCollisions() {
        for (let mimic of mimics) {
            if (mimic.lane === player.lane && p.abs(mimic.y - player.y) < (mimic.height + player.height) / 2) {
                gameState = 'gameOver';
                if (crashSnd && crashSnd.isLoaded()) crashSnd.play();
                return;
            }
        }
    }

    function drawLanes() {
        p.stroke(255, 255, 255, 80); p.strokeWeight(4);
        for (let i = 1; i < NUM_LANES; i++) { p.line(i * laneWidth, 0, i * laneWidth, p.height); }
        p.noStroke();
    }

    function drawPlayer() {
        if (player && player.img) p.image(player.img, player.x, player.y, player.width, player.height);
    }

    function drawMimics() {
        for (let mimic of mimics) {
            if (!mimic.scored && mimic.img) p.image(mimic.img, mimic.x, mimic.y, mimic.width, mimic.height);
        }
    }

    function drawUI() {
        p.fill(255); p.stroke(0); p.strokeWeight(2); p.textSize(30);
        p.textAlign(p.LEFT, p.TOP);
        p.text(`점수: ${score} / ${TARGET_SCORE}`, 20, 20);
        p.noStroke();
    }

    function displayStartScreen() {
        p.fill(0, 0, 0, 150); p.rect(0, p.height*0.2, p.width, p.height*0.5);
        p.fill(255); p.textSize(32); p.textAlign(p.CENTER, p.CENTER);
        p.text("미메시스를 피해라!", p.width / 2, p.height * 0.3);
        p.textSize(18);
        p.text(`다가오는 미메시스들을 피하세요!\n좌우 화살표 키 또는 스와이프로 트램을 조종하세요.\n(${TARGET_SCORE}점 달성 목표)`, p.width / 2, p.height * 0.45);
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
            console.log(`Avoid Mimesis Game: Saved score of ${score}`);
        }

        let message = "", subMessage = "", bgColor = p.color(100, 100, 100, 220);
        if (gameState === 'win') {
            message = "성공!";
            subMessage = `축하합니다! ${TARGET_SCORE}점을 달성했습니다!`;
            bgColor = p.color(150, 255, 150, 220);
        } else if (gameState === 'gameOver') {
            message = "게임 오버";
            subMessage = `미메시스와 충돌! 최종 점수: ${score}`;
            bgColor = p.color(255, 150, 150, 220);
        } else if (gameState === 'error') {
            message = "오류 발생";
            subMessage = "게임 에셋 로딩 실패. 콘솔을 확인하세요.";
            bgColor = p.color(100, 100, 0, 220);
        }

        p.fill(bgColor); p.rect(0, 0, p.width, p.height);
        p.fill(0); p.textSize(50); p.textAlign(p.CENTER, p.CENTER);
        p.text(message, p.width / 2, p.height / 2 - 40);
        p.textSize(22);
        p.text(subMessage, p.width / 2, p.height / 2 + 20);
        p.textSize(18);
        p.text("페이지를 새로고침하여 다시 플레이하세요.", p.width / 2, p.height / 2 + 70);
        p.noLoop();
    }
};
