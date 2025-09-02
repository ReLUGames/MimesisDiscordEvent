function sketchSpotTheDifference(p) {

    // --- Asset & Visual Configuration ---
    const assetFolder = 'src/images/spotdifference/';
    const debug_test = false; // Set to true to show all difference locations in red

    // --- Game State Variables ---
    let remainingLevels = [];
    let imageA, imageB; // imageA is top (original), imageB is bottom (interactive)
    let targets = []; // Array of {x, y} differences from JSON for the current level
    let foundTargets = []; // Array of targets found in the current level
    let translatedTargets = []; // Array of {x, y} scaled to the canvas
    let score = 0;
    const roundTime = 30; // 30 seconds per round
    const totalRounds = 6;
    let timer = roundTime;
    let gameState = 'initializing'; // States: loading, countdown, playing, level_transition, gameOver, error

    // --- UI, Animation, and Visual Effect Variables ---
    let particles = [];
    let feedbackAnimations = [];
    let uiPanelY;
    let countdownValue = 3;
    let lastCountdownTime = 0;
    let lastInputTime = 0; 

    // --- Sound Assets ---
    let bgm, sfxGood, sfxWrong;

    p.preload = function() {
        p.soundFormats('mp3');
        try {
            bgm = p.loadSound('src/bgm/puzzle take1.mp3');
            sfxGood = p.loadSound('src/sfx/good.mp3');
            sfxWrong = p.loadSound('src/sfx/wrong.mp3');
        } catch (e) {
            console.error("Error loading sound assets.", e);
        }
    }

    p.setup = function() {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.textFont('Segoe UI');
        uiPanelY = p.height + 100;

        for (let i = 0; i < 100; i++) {
            particles.push({
                x: p.random(p.width), y: p.random(p.height),
                vx: p.random(-0.3, 0.3), vy: p.random(-0.3, 0.3),
                alpha: p.random(50, 150)
            });
        }
    };
    
    p.windowResized = function() {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        uiPanelY = p.height + 100; 
    }

    async function resetGame() {
        score = 0;
        timer = roundTime;
        feedbackAnimations = [];
        gameState = 'loading';

        const probeFile = (url) => {
            return new Promise((resolve, reject) => {
                const isImage = url.endsWith('.webp');
                if (isImage) {
                    const img = new Image();
                    img.onload = () => resolve(url);
                    img.onerror = () => reject(url);
                    img.src = url;
                } else {
                    fetch(url).then(res => res.ok ? resolve(url) : reject(url)).catch(() => reject(url));
                }
            });
        };

        const probeLevelSet = (basename) => {
            const pathA = assetFolder + basename + 'a.webp';
            const pathB = assetFolder + basename + 'b.webp';
            const pathJson = assetFolder + basename + '.json';
            return Promise.all([probeFile(pathA), probeFile(pathB), probeFile(pathJson)])
                .then(() => basename);
        };

        const maxLevelsToProbe = 100;
        let probePromises = [];

        for (let i = 1; i <= maxLevelsToProbe; i++) {
            const numberString = i.toString().padStart(3, '0');
            const basename = `sd${numberString}`;
            probePromises.push(probeLevelSet(basename));
        }

        const results = await Promise.allSettled(probePromises);
        const existingLevels = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);

        if (existingLevels.length === 0) {
            console.error("No complete level sets (e.g., sd001a.webp, sd001b.webp, sd001.json) were found.");
            gameState = 'error';
            return;
        }

        p.shuffle(existingLevels, true);
        remainingLevels = existingLevels.slice(0, totalRounds);
        
        console.log(`Found ${existingLevels.length} valid levels. Starting game with ${remainingLevels.length} rounds.`);
        nextLevel(true);
    }

    function nextLevel(isFirstLevel = false) {
        if (remainingLevels.length === 0) {
            endGame("You found them all!");
            return;
        }

        gameState = 'loading';
        const nextLevelBase = remainingLevels.shift();
        const pathA = assetFolder + nextLevelBase + 'a.webp';
        const pathB = assetFolder + nextLevelBase + 'b.webp';
        const pathJson = assetFolder + nextLevelBase + '.json';
        
        targets = [];
        foundTargets = [];
        translatedTargets = [];
        timer = roundTime;

        let assetsToLoad = 3;
        const onAssetLoaded = () => {
            assetsToLoad--;
            if (assetsToLoad === 0) onAllAssetsLoaded(isFirstLevel);
        };
        
        imageA = p.loadImage(pathA, onAssetLoaded, onAssetError);
        imageB = p.loadImage(pathB, onAssetLoaded, onAssetError);
        p.loadJSON(pathJson, (data) => {
            targets = data.answers;
            onAssetLoaded();
        }, onAssetError);
    }

    function onAllAssetsLoaded(isFirstLevel) {
        if (isFirstLevel) {
            gameState = 'countdown';
            countdownValue = 3;
            lastCountdownTime = p.millis();
        } else {
            gameState = 'playing';
        }
    }

    function onAssetError(err) {
        console.error("Failed to load game assets:", err);
        gameState = 'error';
    }
    
    function drawDynamicBackground() {
        p.background('#1a1a2e');
        p.noStroke();
        for (const particle of particles) {
            particle.x += particle.vx;
            particle.y += particle.vy;
            if (particle.x < 0 || particle.x > p.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > p.height) particle.vy *= -1;
            p.fill(255, 255, 255, particle.alpha);
            p.ellipse(particle.x, particle.y, 2, 2);
        }
    }

    p.draw = function() {
        drawDynamicBackground();

        switch (gameState) {
            case 'initializing':
                gameState = 'loading';
                resetGame();
                break;
            case 'loading':
                p.textAlign(p.CENTER, p.CENTER);
                drawText("Loading...", p.width / 2, p.height / 2, p.width * 0.08);
                break;
            case 'countdown':
                drawCountdown();
                break;
            case 'playing':
            case 'level_transition':
                runGame();
                break;
            case 'gameOver':
                p.fill(0, 0, 0, 150);
                p.rect(0, 0, p.width, p.height);
                p.textAlign(p.CENTER, p.CENTER);
                const gameOverSize = p.constrain(p.width * 0.1, 32, 120);
                const finalScoreSize = p.constrain(p.width * 0.08, 24, 96);
                drawText("Game Over", p.width / 2, p.height / 2 - gameOverSize * 0.7, gameOverSize);
                drawText(`Final Score: ${score}`, p.width / 2, p.height / 2 + finalScoreSize * 0.7, finalScoreSize);
                break;
            case 'error':
                drawText("Error loading game files.", p.width / 2, p.height / 2, p.width * 0.05);
                break;
        }
    };

    function drawCountdown() {
        const titleSize = p.constrain(p.width * 0.07, 20, 48);
        const numberSize = p.constrain(p.width * 0.3, 80, 150);

        p.textAlign(p.CENTER, p.CENTER);
        drawText("Spot The Difference!", p.width / 2, p.height * 0.3, titleSize, '#e0e0ff');
        drawText(countdownValue, p.width / 2, p.height / 2, numberSize);

        if (p.millis() - lastCountdownTime > 1000) {
            countdownValue--;
            lastCountdownTime = p.millis();
        }
        if (countdownValue < 1) {
            gameState = 'playing';
            if (bgm && bgm.isLoaded() && !bgm.isPlaying()) {
                bgm.setVolume(0.3);
                bgm.loop();
            }
        }
    }
    
    function runGame() {
        const panelHeight = p.constrain(p.height * 0.1, 70, 90);
        const padding = p.min(p.width, p.height) * 0.02;
        const availableGameHeight = p.height - panelHeight;
        const singleImageAreaHeight = (availableGameHeight - padding * 3) / 2;

        const topArea = {
            x: padding, y: padding,
            w: p.width - padding * 2, h: singleImageAreaHeight
        };
        const bottomArea = {
            x: padding, y: padding + singleImageAreaHeight + padding,
            w: p.width - padding * 2, h: singleImageAreaHeight
        };

        const drawFittedImage = (img, area) => {
            if (!img || img.width <= 1 || area.h <= 0) return { imgX: 0, imgY: 0, imgWidth: 0, imgHeight: 0 };
            let imgRatio = img.width / img.height;
            let areaRatio = area.w / area.h;
            let imgWidth, imgHeight, imgX, imgY;

            if (imgRatio > areaRatio) {
                imgWidth = area.w;
                imgHeight = area.w / imgRatio;
            } else {
                imgHeight = area.h;
                imgWidth = area.h * imgRatio;
            }
            imgX = area.x + (area.w - imgWidth) / 2;
            imgY = area.y + (area.h - imgHeight) / 2;
            p.image(img, imgX, imgY, imgWidth, imgHeight);
            return { imgX, imgY, imgWidth, imgHeight };
        };

        drawFittedImage(imageA, topArea);
        const bottomImgMetrics = drawFittedImage(imageB, bottomArea);
        
        const textSize = p.constrain(p.width * 0.02, 14, 20);
        p.textAlign(p.CENTER, p.CENTER);
        drawText("Original", p.width / 2, topArea.y / 2 + textSize / 2, textSize, '#ffffff99');
        const findTextY = topArea.y + topArea.h + padding / 2;
        drawText("Find the differences below 👇", p.width / 2, findTextY, textSize, '#ffffffcc');

        const scaleFactor = bottomImgMetrics.imgWidth / imageB.width;
        translatedTargets = targets.map(target => ({
            x: (target.x * scaleFactor) + bottomImgMetrics.imgX,
            y: (target.y * scaleFactor) + bottomImgMetrics.imgY,
        }));

        const targetRadius = p.width * 0.025;
        p.noFill();
        p.strokeWeight(4);
        foundTargets.forEach(found => {
            const originalIndex = targets.findIndex(t => t.x === found.x && t.y === found.y);
            if (originalIndex !== -1) {
                const translated = translatedTargets[originalIndex];
                p.stroke(76, 175, 80, 200);
                p.ellipse(translated.x, translated.y, targetRadius * 2);
            }
        });
        
        if (debug_test) {
            p.stroke(255, 0, 0);
            p.strokeWeight(2);
            translatedTargets.forEach(tt => p.ellipse(tt.x, tt.y, targetRadius * 2));
        }

        if (gameState === 'playing') {
            timer -= p.deltaTime / 1000;
            if (timer <= 0) {
                timer = 0;
                endGame("Time's Up!");
            }
        }

        drawScoreDisplay();
        drawUI();
        drawFeedbackAnimations();
    }
    
    function drawScoreDisplay() {
        const scoreSize = p.constrain(p.width * 0.05, 24, 40);
        const iconSize = scoreSize * 0.8;
        const margin = p.width * 0.04;

        p.push();
        p.textAlign(p.LEFT, p.CENTER);
        p.fill('#FFD700');
        p.noStroke();
        p.ellipse(margin, margin, iconSize, iconSize);
        drawText(score, margin + iconSize * 0.8, margin, scoreSize);
        p.pop();
    }

    function drawUI() {
        const panelHeight = p.constrain(p.height * 0.1, 70, 90);
        const targetY = p.height - panelHeight;
        uiPanelY = p.lerp(uiPanelY, targetY, 0.1);

        p.noStroke();
        p.fill(0, 0, 0, 100);
        p.rect(0, uiPanelY, p.width, panelHeight);
        
        const iconSize = panelHeight * 0.3;
        const scoreY = uiPanelY + panelHeight / 2;
        const barHeight = panelHeight * 0.35;
        const barWidth = p.width * 0.5;
        const barX = p.width / 2 - barWidth / 2;
        const barY = uiPanelY + panelHeight / 2 - barHeight / 2;
        
        p.noFill();
        p.stroke(255);
        p.strokeWeight(2);
        p.ellipse(barX - iconSize, scoreY, iconSize, iconSize);
        p.rect(barX - iconSize - (iconSize * 0.15), barY - (iconSize * 0.05), iconSize * 0.3, iconSize * 0.1);
        p.rect(barX, barY, barWidth, barHeight, 5);

        const timeRatio = p.constrain(timer / roundTime, 0, 1);
        const currentBarWidth = barWidth * timeRatio;
        const barColor = timer < 10 ? '#ff4d4d' : '#4CAF50';
        if (currentBarWidth > 1) {
             p.noStroke();
             p.fill(barColor);
             p.rect(barX + 1, barY + 1, currentBarWidth - 2, barHeight - 2, 4);
        }
    }

    function drawFeedbackAnimations() {
        for (let i = feedbackAnimations.length - 1; i >= 0; i--) {
            let anim = feedbackAnimations[i];
            p.push();
            if (anim.type === 'text') {
                p.fill(anim.color[0], anim.color[1], anim.color[2], anim.alpha);
                p.stroke(0);
                p.strokeWeight(3);
                p.textSize(anim.size);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(anim.text, anim.x, anim.y);
            } else if (anim.type === 'ring') {
                p.noFill();
                p.stroke(anim.color[0], anim.color[1], anim.color[2], anim.alpha);
                p.strokeWeight(4);
                p.ellipse(anim.x, anim.y, anim.radius * 2);
                anim.radius += p.width * 0.005;
            }
            p.pop();

            anim.alpha -= 5;
            if (anim.alpha <= 0) {
                feedbackAnimations.splice(i, 1);
            }
        }
    }

    function drawText(str, x, y, size, col = '#ffffff') {
        p.fill(col);
        p.stroke(0);
        p.strokeWeight(p.constrain(size * 0.1, 1, 6));
        p.textSize(size);
        p.text(str, x, y);
    }

    p.mousePressed = function() {
        if (p.millis() - lastInputTime < 100) {
            return;
        }
        lastInputTime = p.millis();
        if (gameState !== 'playing') return;
        
        const panelHeight = p.constrain(p.height * 0.1, 70, 90);
        const availableGameHeight = p.height - panelHeight;
        if (p.mouseY < availableGameHeight / 2 || p.mouseY > availableGameHeight) return;

        const isMobile = p.windowWidth < 768;
        const targetRadius = isMobile ? p.width * 0.04 : p.width * 0.025;
        const feedbackTextSize = p.constrain(p.width * 0.08, 32, 60);
        let foundSomething = false;

        for (let i = 0; i < targets.length; i++) {
            const originalTarget = targets[i];
            const translated = translatedTargets[i];

            if (foundTargets.some(ft => ft.x === originalTarget.x && ft.y === originalTarget.y)) {
                continue;
            }

            let d = p.dist(p.mouseX, p.mouseY, translated.x, translated.y);

            if (d < targetRadius) {
                foundSomething = true;
                if (sfxGood && sfxGood.isLoaded()) { sfxGood.setVolume(0.5); sfxGood.play(); }
                
                foundTargets.push(originalTarget);
                feedbackAnimations.push({ type: 'ring', x: translated.x, y: translated.y, radius: targetRadius * 0.5, alpha: 255, color: [76, 175, 80] });
                
                if (foundTargets.length === targets.length) {
                    score += 5;
                    gameState = 'level_transition';
                    setTimeout(() => {
                        nextLevel();
                    }, 800);
                }
                break;
            }
        }

        if (!foundSomething) {
            if (sfxWrong && sfxWrong.isLoaded()) { sfxWrong.setVolume(0.5); sfxWrong.play(); }
            timer -= 2;
            feedbackAnimations.push({ type: 'text', text: '-2s', x: p.mouseX, y: p.mouseY, size: feedbackTextSize, alpha: 255, color: [255, 77, 77] });
        }
    };

    // MODIFIED: This function now includes the salt when dispatching the event
    function endGame(message) {
        if (gameState === 'gameOver') return;
        gameState = 'gameOver';
        if (bgm && bgm.isPlaying()) bgm.stop();

        const gameSalt = sessionStorage.getItem('currentGameSalt');
        const scoreEvent = new CustomEvent('gameComplete', {
            detail: {
                gameId: "spot_the_difference", 
                score: score, 
                salt: gameSalt 
            }
        });
        window.dispatchEvent(scoreEvent);
        
        // This timeout remains, allowing the 'Game Over' screen to show briefly
        setTimeout(() => {
            p.noLoop();
            // The cleanup is handled by the main page's event listener now,
            // but we can leave this here as a fallback.
        }, 3000);
    }
    
    p.cleanup = function() {
        if (bgm && bgm.isPlaying()) bgm.stop();
        p.noLoop();
    };
}