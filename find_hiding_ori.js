function sketchFindHidingGame(p) {

    // --- Asset & Visual Configuration ---
    const assetFolder = 'src/images/findhiddenori/';
    const debug_test = true;

    // --- Game State Variables ---
    let remainingImages = [];
    let currentImage;
    let target;
    let translatedTarget = { x: 0, y: 0 };
    let score = 0;
    const maxTime = 30;
    let timer = maxTime;
    let gameState = 'loading'; // States: loading, countdown, playing, gameOver, error

    // --- UI, Animation, and Visual Effect Variables ---
    let particles = [];
    let feedbackAnimations = [];
    let uiPanelY;
    let countdownValue = 3;
    let lastCountdownTime = 0;
    let isFirstLevel = true;


    p.setup = function() {
        // Set canvas size based on the container provided in index.html
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.textFont('Segoe UI');
        
        uiPanelY = p.height + 100; // Start panel off-screen

        // Create background particles
        for (let i = 0; i < 100; i++) {
            particles.push({
                x: p.random(p.width),
                y: p.random(p.height),
                vx: p.random(-0.3, 0.3),
                vy: p.random(-0.3, 0.3),
                alpha: p.random(50, 150)
            });
        }
        resetGame();
    };
    
    p.windowResized = function() {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        // Reset UI panel position to handle orientation changes
        uiPanelY = p.height + 100; 
    }

    // --- MODIFIED: Fully automated image discovery and tiered shuffling ---
    async function resetGame() {
        score = 0;
        timer = maxTime;
        feedbackAnimations = [];
        gameState = 'loading';
        isFirstLevel = true;

        // This helper function tries to load an image and returns a Promise.
        // It resolves if the image exists and rejects if it doesn't (404 error).
        const probeImage = (url) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(url);
                img.onerror = () => reject(url);
                img.src = url;
            });
        };

        const maxImagesToProbe = 100; // Will check for up to 100 images per difficulty tier.
        let probePromises = [];

        // Create a list of all possible image paths to check.
        for (let tier = 0; tier < 3; tier++) { // Tiers 0 (easy), 1 (medium), 2 (hard)
            for (let i = 1; i <= maxImagesToProbe; i++) {
                const numberString = i.toString().padStart(2, '0');
                const filename = `${tier}${numberString}.png`;
                const path = assetFolder + filename;
                probePromises.push(probeImage(path));
            }
        }

        // Run all the checks at once and wait for them to finish.
        const results = await Promise.allSettled(probePromises);

        // Filter out only the images that successfully loaded.
        const existingImageFiles = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value.split('/').pop()); // Get just the filename (e.g., "001.png")

        // Group the existing files by difficulty tier.
        let easyTier = existingImageFiles.filter(file => file.startsWith('0'));
        let mediumTier = existingImageFiles.filter(file => file.startsWith('1'));
        let hardTier = existingImageFiles.filter(file => file.startsWith('2'));

        // Shuffle each tier independently.
        p.shuffle(easyTier, true);
        p.shuffle(mediumTier, true);
        p.shuffle(hardTier, true);

        // Combine the shuffled tiers in order of difficulty.
        remainingImages = [...easyTier, ...mediumTier, ...hardTier];
        
        if (remainingImages.length === 0) {
            console.error("No image files were found in the asset folder. Make sure they are named correctly (e.g., 001.png).");
            gameState = 'error';
            return;
        }

        console.log(`Found ${remainingImages.length} images across ${easyTier.length} easy, ${mediumTier.length} medium, and ${hardTier.length} hard tiers.`);
        nextLevel();
    }

    function nextLevel() {
        if (remainingImages.length === 0) {
            endGame("You found them all!");
            return;
        }
        gameState = 'loading';
        const nextImageFile = remainingImages.shift(); 
        const baseFileName = nextImageFile.replace(/\.[^/.]+$/, "");
        const imagePath = assetFolder + nextImageFile;
        const jsonPath = assetFolder + baseFileName + ".json";
        
        target = null; 

        currentImage = p.loadImage(imagePath, onImageLoad, onAssetError);
        target = p.loadJSON(jsonPath, onJsonLoad, onAssetError);
    }

    function onAssetsLoaded() {
        if (gameState !== 'loading') return;
        if (isFirstLevel) {
            gameState = 'countdown';
            countdownValue = 3;
            lastCountdownTime = p.millis();
            isFirstLevel = false;
        } else {
            gameState = 'playing';
        }
    }

    function onImageLoad() { if (target && target.x !== undefined) onAssetsLoaded(); }
    function onJsonLoad() { if (currentImage && currentImage.width > 1) onAssetsLoaded(); }
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
            case 'loading':
                drawText("Loading...", p.width / 2, p.height / 2, p.width * 0.08);
                break;
            case 'countdown':
                drawCountdown();
                break;
            case 'playing':
                runGame();
                break;
            case 'gameOver':
                p.fill(0, 0, 0, 150);
                p.rect(0, 0, p.width, p.height);
                p.textAlign(p.CENTER, p.CENTER);

                const gameOverSize = p.constrain(p.width * 0.1, 32, 120);
                const finalScoreSize = p.constrain(p.width * 0.08, 24, 96);

                const gameOverY = p.height / 2 - gameOverSize * 0.7;
                const finalScoreY = p.height / 2 + finalScoreSize * 0.7;

                drawText("Game Over", p.width / 2, gameOverY, gameOverSize);
                drawText(`Final Score: ${score}`, p.width / 2, finalScoreY, finalScoreSize);
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
        drawText("Find the Hiding MIMESIS!", p.width / 2, p.height * 0.3, titleSize, '#e0e0ff');
        drawText(countdownValue, p.width / 2, p.height / 2, numberSize);

        if (p.millis() - lastCountdownTime > 1000) {
            countdownValue--;
            lastCountdownTime = p.millis();
        }
        if (countdownValue < 1) {
            gameState = 'playing';
        }
    }

    function runGame() {
        // Draw the main game image
        let imgRatio = currentImage.width / currentImage.height;
        let canvasRatio = p.width / p.height;
        let imgWidth, imgHeight, imgX, imgY;
        if (imgRatio > canvasRatio) {
            imgWidth = p.width;
            imgHeight = p.width / imgRatio;
        } else {
            imgHeight = p.height;
            imgWidth = p.height * imgRatio;
        }
        imgX = (p.width - imgWidth) / 2;
        imgY = (p.height - imgHeight) / 2;
        p.image(currentImage, imgX, imgY, imgWidth, imgHeight);

        // Update target position based on scaled image
        const scaleFactor = imgWidth / currentImage.width;
        translatedTarget.x = (target.x * scaleFactor) + imgX;
        translatedTarget.y = (target.y * scaleFactor) + imgY;
        
        // If debug_test is true, draw a circle around the target area.
        if (debug_test) {
            p.noFill();
            p.stroke(255, 0, 0); // Red circle for high visibility
            p.strokeWeight(2);
            const targetRadius = p.width * 0.02;
            p.ellipse(translatedTarget.x, translatedTarget.y, targetRadius * 2);
        }

        // Update timer
        timer -= p.deltaTime / 1000;
        if (timer <= 0) {
            timer = 0;
            endGame("Time's Up!");
        }

        // Draw UI elements in order
        drawScoreDisplay(); // Draw score at the top
        drawUI(); // Draw bottom panel with timer
        drawFeedbackAnimations(); // Draw animations on top of everything
    }
    
    function drawScoreDisplay() {
        const scoreSize = p.constrain(p.width * 0.05, 24, 40);
        const iconSize = scoreSize * 0.8;
        const margin = p.width * 0.04; // Margin from the edge

        p.push(); // Isolate text alignment settings
        p.textAlign(p.LEFT, p.CENTER);

        // Draw score icon
        p.fill('#FFD700');
        p.noStroke();
        p.ellipse(margin, margin, iconSize, iconSize);

        // Draw score text
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

        // Centered Timer Bar
        const barHeight = panelHeight * 0.35;
        const barWidth = p.width * 0.5; // Make bar wider
        const barX = p.width / 2 - barWidth / 2; // Center the bar
        const barY = uiPanelY + panelHeight / 2 - barHeight/2;
        
        p.noFill();
        p.stroke(255);
        p.strokeWeight(2);
        // Draw stopwatch icon to the left of the bar
        p.ellipse(barX - iconSize, scoreY, iconSize, iconSize);
        p.rect(barX - iconSize - (iconSize*0.15), barY - (iconSize*0.05), iconSize*0.3, iconSize*0.1);

        // Draw the timer bar background
        p.rect(barX, barY, barWidth, barHeight, 5);

        // Draw the actual time remaining
        const timeRatio = p.constrain(timer / maxTime, 0, 1);
        const currentBarWidth = barWidth * timeRatio;
        const barColor = timer < 10 ? '#ff4d4d' : '#4CAF50';
        if (currentBarWidth > 1) {
             p.noStroke();
             p.fill(barColor);
             p.rect(barX+1, barY+1, currentBarWidth-2, barHeight-2, 4);
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
                anim.radius += p.width * 0.005; // Scale animation speed
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
        if (gameState !== 'playing') return;

        const targetRadius = p.width * 0.02; // Make target radius responsive
        let d = p.dist(p.mouseX, p.mouseY, translatedTarget.x, translatedTarget.y);

        const feedbackTextSize = p.constrain(p.width * 0.08, 32, 60);

        if (d < targetRadius) {
            score++;
            timer = p.min(timer + 5, maxTime);
            feedbackAnimations.push({ type: 'text', text: '+5s', x: p.mouseX, y: p.mouseY - 40, size: feedbackTextSize, alpha: 255, color: [76, 175, 80] });
            feedbackAnimations.push({ type: 'ring', x: translatedTarget.x, y: translatedTarget.y, radius: targetRadius * 0.5, alpha: 255, color: [76, 175, 80] });
            nextLevel();
        } else {
            timer -= 2;
            feedbackAnimations.push({ type: 'text', text: '-2s', x: p.mouseX, y: p.mouseY, size: feedbackTextSize, alpha: 255, color: [255, 77, 77] });
            feedbackAnimations.push({ type: 'ring', x: p.mouseX, y: p.mouseY, radius: targetRadius * 0.5, alpha: 200, color: [255, 77, 77] });
        }
    };

    function endGame(message) {
        if (gameState === 'gameOver') return;
        gameState = 'gameOver';
        if (window.saveScore) window.saveScore('hiding', score);
        
        setTimeout(() => {
            p.noLoop();
            if (typeof cleanupPreviousGame === 'function') {
                cleanupPreviousGame();
            } else {
                window.location.reload(); // Fallback
            }
        }, 3000);
    }
    
    p.cleanup = function() {
        p.noLoop();
    };
}
