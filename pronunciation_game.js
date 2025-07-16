// pronunciation_game.js - Instance Mode with Score Saving

var sketchPronunciationGame = function(p) {

    // --- Sketch-Scoped Variables ---
    const GAME_ID = 'pronunciation';
    let gameState = 'unloaded';
    let currentRound = 0; let targetWord = ''; let feedbackMessage = ''; let wordColor;
    const chosenLang = 'en-US'; const totalRounds = 3;
    let scoreSaved = false; // <<< ADDED: Flag to prevent multiple score saves

    // Assets & Positioning
    let characterImgIdle; let characterWalkGif;
    let characterX, characterY; let characterStartX; let characterTargetX;
    let characterState = 'idle'; let charSpeed = 3;
    let desiredCharacterHeight = 60; let characterWidth; let characterHeight = desiredCharacterHeight;
    let characterAspectRatio = 1;
    const characterImageUrl = 'src/images/Ori_pixel.png';
    const characterWalkGifUrl = 'src/images/ori_walk.gif';

    // Wall
    let wallVisible = true; let wallX; let wallWidth = 30; let wallHeight;

    // Play Area Definition
    let playAreaX, playAreaY, playAreaW, playAreaH;
    let dimmingAlpha = 80;

    // Webcam Capture
    let capture;
    let webcamReady = false;

    // Speech Recognition
    let recognition;
    let isListening = false;
    let speechApiSupported = false;

    // Word Lists
    const words = [
        ['Apple', 'Hello', 'Banana', 'Water', 'School'],
        ['Computer', 'Library', 'Internet', 'Programming', 'Language'],
        ['Recite', 'Standard', 'Collision', 'Throughout', 'Worcestershire']
    ];

    p.preload = function() {
        console.log("Pronunciation Game (Instance): preload()");
        try {
            characterImgIdle = p.loadImage(characterImageUrl,
                (img) => {
                    console.log("Pronunciation Instance: Idle Image loaded");
                    if (img.height > 0) { characterAspectRatio = img.width / img.height; }
                },
                (err) => { console.error("Pronunciation Instance: Failed to load idle image:", err); gameState = 'preload_error'; }
            );
        } catch(e) { console.error("Pronunciation Instance: Preload Exception", e); gameState = 'preload_error'; }
    };

    p.setup = function() {
        console.log("Pronunciation Game (Instance): setup()");
        if (gameState === 'preload_error') {
            let cnv = p.createCanvas(p.windowWidth * 0.8, p.windowHeight * 0.8);
            p.background(50,0,0); p.fill(255); p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
            p.text("Error loading game assets. Check console.", p.width/2, p.height/2);
            p.noLoop(); return;
        }

        let cnv = p.createCanvas(500, 800);
        characterStartX = p.width * 0.15;
        characterX = characterStartX;
        characterY = p.height / 2;
        characterTargetX = characterX;
        wallX = p.width / 2;
        characterHeight = desiredCharacterHeight;
        if (characterImgIdle && characterImgIdle.height > 0) {
            characterAspectRatio = characterImgIdle.width / characterImgIdle.height;
            characterWidth = characterHeight * characterAspectRatio;
        } else {
            characterWidth = characterHeight;
        }
        wallHeight = characterHeight * 1.5;

        playAreaW = p.width * 0.85;
        playAreaH = wallHeight * 1.8;
        playAreaX = (p.width - playAreaW) / 2;
        playAreaY = p.height / 2 - playAreaH / 2;

        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(48);
        p.imageMode(p.CENTER);

        let existingGif = document.getElementById('walk-gif');
        if (existingGif) existingGif.remove();
        characterWalkGif = p.createImg(characterWalkGifUrl, 'walking character');
        characterWalkGif.id('walk-gif');
        characterWalkGif.style('position', 'absolute');
        characterWalkGif.style('image-rendering', 'pixelated');
        characterWalkGif.style('pointer-events', 'none');
        characterWalkGif.hide();

        try {
            capture = p.createCapture(p.VIDEO, () => {
                webcamReady = true;
                console.log("Pronunciation Instance: Webcam capture started.");
            });
            capture.hide();
        } catch (err) {
            console.error("Pronunciation Instance: Could not initialize webcam:", err);
        }

        setupSpeechRecognition();
        wordColor = p.color(255);

        // <<< MODIFIED: Reset state variables for a fresh start >>>
        gameState = 'START_ROUND';
        currentRound = 0;
        targetWord = '';
        feedbackMessage = '';
        scoreSaved = false; // Reset score saved flag
        characterState = 'idle';
        wallVisible = true;
        isListening = false;
    };

    p.draw = function() {
        if (!gameState || gameState === 'unloaded' || gameState === 'preload_error') { return; }

        if (webcamReady && capture && capture.loadedmetadata && capture.width > 0) {
            let targetAspectRatio = p.width / p.height;
            let sourceAspectRatio = capture.width / capture.height;
            let sx = 0, sy = 0, sWidth = capture.width, sHeight = capture.height;
            if (sourceAspectRatio > targetAspectRatio) { sWidth = capture.height * targetAspectRatio; sx = (capture.width - sWidth) / 2; }
            else { sHeight = capture.width / targetAspectRatio; sy = (capture.height - sHeight) / 2; }
            p.imageMode(p.CORNER);
            p.image(capture, 0, 0, p.width, p.height, sx, sy, sWidth, sHeight);
            p.imageMode(p.CENTER);
        } else {
            p.background(30, 30, 40);
        }

        p.fill(0, 0, 0, dimmingAlpha);
        p.noStroke();
        p.rectMode(p.CORNER);
        p.rect(0, 0, p.width, playAreaY);
        p.rect(0, playAreaY + playAreaH, p.width, p.height - (playAreaY + playAreaH));
        p.rect(0, playAreaY, playAreaX, playAreaH);
        p.rect(playAreaX + playAreaW, playAreaY, p.width - (playAreaX + playAreaW), playAreaH);

        drawWall();
        drawCharacter();

        if (!speechApiSupported && p.frameCount > 60) {
            displayApiNotSupported(); return;
        }

        if (gameState === 'ANIMATING_SUCCESS' || gameState === 'ANIMATING_FAILURE') {
            updateCharacterPosition();
        }
        displayUiText();

        switch (gameState) {
            case 'START_ROUND':
                wallVisible = true; characterX = characterStartX; characterState = 'idle';
                if (characterWalkGif) characterWalkGif.hide();
                if (!targetWord) { selectWordForRound(); }
                if (targetWord) { gameState = 'LISTENING'; }
                else if (currentRound >= totalRounds) { gameState = 'GAME_OVER'; }
                break;
            case 'LISTENING':
                if (!isListening) { startListening(); }
                break;
            case 'SHOW_RESULT': if (characterWalkGif) characterWalkGif.hide(); break;
            case 'ANIMATING_SUCCESS': case 'ANIMATING_FAILURE': break;
            case 'GAME_OVER':
                if (characterWalkGif) characterWalkGif.hide();
                if (isListening && recognition) { try {recognition.stop();} catch(e){} isListening = false; }
                
                // <<< MODIFIED: Save score on game over >>>
                if (!scoreSaved) {
                    // The score is the number of rounds successfully completed.
                    window.saveScore(GAME_ID, currentRound);
                    scoreSaved = true;
                    console.log(`Pronunciation Game: Saved score of ${currentRound}`);
                }
                // Display handled by displayUiText, which also calls noLoop()
                break;
        }
    };

    function displayUiText() {
        p.fill(255); p.stroke(0); p.strokeWeight(3); p.textAlign(p.CENTER, p.CENTER);
        if (gameState !== 'GAME_OVER') {
            p.textSize(24); p.text(`Round ${currentRound + 1}/${totalRounds}`, p.width / 2, 50);
        }
        if (gameState !== 'GAME_OVER' && targetWord) {
            let textBoxWidth = p.width * 0.8; let wordTextSize = 50; let wordDisplayY = p.height * 0.4;
            p.rectMode(p.CENTER); p.fill(0, 0, 0, 170); p.noStroke();
            p.rect(p.width / 2, wordDisplayY, p.min(textBoxWidth + 30, p.width * 0.95), 80, 15);
            p.fill(wordColor); p.stroke(0); p.strokeWeight(4); p.textSize(wordTextSize);
            p.text(targetWord, p.width / 2, wordDisplayY, textBoxWidth);
            p.rectMode(p.CORNER);
        }
        if (feedbackMessage) {
            p.noStroke(); p.fill(230); p.textSize(32); p.textAlign(p.CENTER, p.CENTER);
            p.fill(0, 0, 0, 150); p.rectMode(p.CENTER);
            let msgWidth = p.max(p.textWidth(feedbackMessage) + 40, 200);
            p.rect(p.width / 2, p.height * 0.65, msgWidth, 60, 10);
            p.fill(255); p.text(feedbackMessage, p.width / 2, p.height * 0.65);
            p.rectMode(p.CORNER);
        }
        if (gameState === 'GAME_OVER') {
            p.stroke(0); p.strokeWeight(4); p.fill(0, 200, 0); p.textSize(60); p.textAlign(p.CENTER, p.CENTER);
            p.text("Verification\nComplete!", p.width / 2, p.height / 2);
            p.fill(255); p.textSize(20);
            p.text("Refresh or choose another game.", p.width / 2, p.height * 0.7);
            p.noLoop();
        }
        p.noStroke(); p.strokeWeight(1);
    }

    function drawWall() {
        if (wallVisible) {
            p.fill(0, 0, 0, 200); p.noStroke(); p.rectMode(p.CENTER);
            let wallDrawY = p.constrain(p.height / 2, playAreaY + wallHeight / 2, playAreaY + playAreaH - wallHeight / 2);
            p.rect(wallX, wallDrawY, wallWidth, wallHeight);
            p.rectMode(p.CORNER);
       }
    }

    function drawCharacter() {
        characterY = p.constrain(characterY, playAreaY + characterHeight / 2, playAreaY + playAreaH - characterHeight / 2);
        let currentDisplayWidth = (characterAspectRatio > 0) ? characterHeight * characterAspectRatio : characterWidth;
        if (characterState === 'idle' || characterState === 'returning') {
            if (characterWalkGif) characterWalkGif.hide();
            if (characterImgIdle) { p.image(characterImgIdle, characterX, characterY, currentDisplayWidth, characterHeight); }
       } else if (characterState === 'walking' || characterState === 'walking_correct') {
            if (characterWalkGif) {
                characterWalkGif.show();
                let canvasElement = p.canvas;
                if (!canvasElement) return;
                let rect = canvasElement.getBoundingClientRect();
                let scrollX = window.scrollX || window.pageXOffset;
                let scrollY = window.scrollY || window.pageYOffset;
                characterWalkGif.size(currentDisplayWidth, characterHeight);
                characterWalkGif.position(rect.left + scrollX + characterX - (currentDisplayWidth / 2),
                                          rect.top + scrollY + characterY - (characterHeight / 2));
            } else if (characterImgIdle) {
                p.image(characterImgIdle, characterX, characterY, currentDisplayWidth, characterHeight);
            }
       } else {
            if (characterWalkGif) characterWalkGif.hide();
            if (characterImgIdle) { p.image(characterImgIdle, characterX, characterY, currentDisplayWidth, characterHeight); }
       }
        characterWidth = currentDisplayWidth;
    }

    function displayApiNotSupported() {
        p.fill(255, 0, 0); p.stroke(0); p.strokeWeight(2); p.textSize(20); p.textAlign(p.CENTER, p.CENTER);
        p.rectMode(p.CENTER); p.fill(0,0,0,150);
        p.rect(p.width/2, p.height * 0.7, 400, 50, 10);
        p.fill(255, 0, 0);
        p.text("Speech Recognition not supported by this browser.", p.width / 2, p.height * 0.7);
        p.noStroke();
        p.rectMode(p.CORNER);
    }

    function selectWordForRound() {
        if (currentRound >= totalRounds) { targetWord = ''; gameState = 'GAME_OVER'; return; }
        if (words && words[currentRound] && words[currentRound].length > 0) {
            targetWord = p.random(words[currentRound]);
            feedbackMessage = "Say the word..."; wordColor = p.color(255);
        } else { targetWord = ''; feedbackMessage = "Word list error!"; wordColor = p.color(255, 0, 0); gameState = 'SHOW_RESULT'; }
    }

    function updateCharacterPosition() {
        let arrived = false; let distance = characterTargetX - characterX;
        if (p.abs(distance) < charSpeed) { characterX = characterTargetX; arrived = true; }
        else { characterX += (distance > 0 ? 1 : -1) * charSpeed; }

        if (arrived) {
            if (characterState === 'walking') { characterState = 'returning'; characterTargetX = characterStartX; }
            else if (characterState === 'returning') { characterState = 'idle'; feedbackMessage = "Say the word..."; wordColor = p.color(255); gameState = 'LISTENING'; }
            else if (characterState === 'walking_correct') {
                characterState = 'idle';
                currentRound++;
                targetWord = '';
                feedbackMessage = '';
                if (currentRound >= totalRounds) {
                    gameState = 'GAME_OVER';
                    if (characterWalkGif) characterWalkGif.hide();
                } else {
                    characterX = characterStartX;
                    characterTargetX = characterStartX;
                    gameState = 'START_ROUND';
                }
            }
        }
    }

    function checkAnswer(spoken) {
        if (!targetWord) { return; }
        const processedSpokenWord = spoken.trim().toLowerCase().replace(/[.,!?;:'"(){}\[\]\-\/\\`~@#$%^&*+=\|<>]/g, '');
        const processedTargetWord = targetWord.toLowerCase().replace(/[.,!?;:'"(){}\[\]\-\/\\`~@#$%^&*+=\|<>]/g, '');
        let correct = (processedSpokenWord === processedTargetWord);
        isListening = false;
        if (correct) {
            feedbackMessage = "Success!"; wordColor = p.color(0, 220, 0);
            wallVisible = false; characterState = 'walking_correct'; characterTargetX = wallX + characterWidth * 0.75; gameState = 'ANIMATING_SUCCESS';
        } else {
            feedbackMessage = "Try Again!"; wordColor = p.color(255, 50, 50);
            wallVisible = true; characterState = 'walking'; characterTargetX = wallX - (wallWidth / 2) - (characterWidth / 2) - 5; gameState = 'ANIMATING_FAILURE';
        }
    }

    function setupSpeechRecognition() {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            speechApiSupported = true;
            recognition = new (window.SpeechRecognition || webkitSpeechRecognition)();
            recognition.continuous = false; recognition.interimResults = false; recognition.lang = chosenLang;
            recognition.onstart = () => { isListening = true; feedbackMessage = "Listening..."; };
            recognition.onresult = (event) => { let spokenWord = event.results[0][0].transcript.trim(); feedbackMessage = "Checking..."; checkAnswer(spokenWord); };
            recognition.onerror = (event) => {
                isListening = false;
                if (event.error === 'no-speech') {
                    feedbackMessage = "Didn't hear that. Try again..."; wordColor = p.color(255, 150, 0); gameState = 'SHOW_RESULT';
                    setTimeout(() => { if (gameState === 'SHOW_RESULT' && currentRound < totalRounds) { feedbackMessage = "Say the word..."; wordColor = p.color(255); gameState = 'LISTENING'; } }, 2000);
                } else {
                    feedbackMessage = `Error: ${event.error}`; wordColor = p.color(255, 0, 0); gameState = 'SHOW_RESULT';
                }
            };
            recognition.onend = () => { isListening = false; if (gameState === 'LISTENING' && currentRound < totalRounds) { startListening(); } };
        } else { speechApiSupported = false; }
    }

    function startListening() {
        if (!speechApiSupported) { return; }
        if (recognition && !isListening && gameState === 'LISTENING') {
            try { recognition.start(); } catch (e) { console.error("Error starting recognition:", e); isListening = false; }
        }
    }

    p.cleanup = function() {
        console.log("Cleaning up Pronunciation Game (Instance) resources...");
        if (recognition && isListening) { try { recognition.stop(); } catch(e){} }
        recognition = null; isListening = false;
        if (capture) { try { capture.stop(); capture.remove(); } catch(e){} }
        capture = null; webcamReady = false;
        if (characterWalkGif) { try { characterWalkGif.remove(); } catch(e){} }
        characterWalkGif = null;
        gameState = 'unloaded';
        scoreSaved = false; // <<< MODIFIED: Reset flag
    };
};
