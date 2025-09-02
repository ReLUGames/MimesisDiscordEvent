// pronunciation_game.js - Enhanced Design & Mobile-Optimized Version
// Features: Modern UI, smooth animations, mobile touch support, visual feedback

var sketchPronunciationGame = function(p) {

    // Helper function to load scripts dynamically
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                console.log(`Script already loaded: ${src}`);
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`Script loaded successfully: ${src}`);
                resolve();
            };
            script.onerror = () => {
                reject(new Error(`Script load error for ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    // Helper function to manually wrap text for all languages
    function formatTextForWrapping(textString, maxWidth, lang) {
        const isCJK = ['ja-JP', 'cmn-Hans-CN', 'ko-KR'].includes(lang);
        const words = isCJK ? textString.split('') : textString.split(' ');
        const separator = isCJK ? '' : ' ';

        if (words.length === 0) return '';

        let lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            let testLine = currentLine + (isCJK ? '' : separator) + words[i];
            if (p.textWidth(testLine) > maxWidth) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        return lines.join('\n');
    }

    // Levenshtein distance function for similarity checking
    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) {
            matrix[0][i] = i;
        }

        for (let j = 0; j <= b.length; j++) {
            matrix[j][0] = j;
        }

        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }

        return matrix[b.length][a.length];
    }

    // --- Game Variables ---
    const GAME_ID = 'human';
    const SIMILARITY_THRESHOLD = 0.8;
    let gameState = 'SELECT_LANGUAGE';
    let currentRound = 0;
    let finalScore = 0;
    let targetWord = '';
    let feedbackMessage = '';
    let wordColor;
    let chosenLang = '';
    const totalRounds = 3;
    let scoreSaved = false;

    // UI Animation variables
    let uiAlpha = 0;
    let targetUiAlpha = 255;
    let animationProgress = 0;
    let pulseAnimation = 0;
    let successParticles = [];
    let starAnimation = 0;

    // Game texts
    let instructionText = '';
    let micErrorText = '';
    let listeningText = '';
    let currentRoundWordList = [];

    const WORDS_PER_ROUND = 2;
    let currentWordInRound = 0;

    const ROUND_DURATION_SECONDS = 30;
    let roundTimer = ROUND_DURATION_SECONDS;
    let roundStartTime;

    // Character & Scene
    let characterImgIdle;
    let characterWalkGif;
    let characterX, characterY;
    let characterStartX;
    let characterTargetX;
    let characterState = 'idle';
    let charSpeed = 10;
    let desiredCharacterHeight = 120;
    let characterWidth;
    let characterHeight = desiredCharacterHeight;
    let characterAspectRatio = 1;
    const characterImageUrl = 'src/images/Ori_pixel.png';
    const characterWalkGifUrl = 'src/images/ori_walk.gif';

    let fallbackBgImg;

    // Wall
    let wallVisible = true;
    let wallX;
    let wallWidth = 60;
    let wallHeight;
    let wallGlowAnimation = 0;

    // Play Area
    let playAreaX, playAreaY, playAreaW, playAreaH;
    let dimmingAlpha = 0;

    // Speech Recognition
    let recognition;
    let isListening = false;
    let speechApiSupported = false;

    // Kuroshiro instance
    let kuroshiroInstance = null;

    // Mobile detection
    let isMobile = false;
    let touchStartY = 0;
    let scrollLocked = false;

    // Language data
    const languageData = {
        'en': {
            langCode: 'en-US',
            nativeName: 'English',
            flag: '🇺🇸',
            instructionText: 'Say the sentence now',
            micErrorText: 'You need a working microphone to play this game',
            listeningText: 'Listening...',
            words: [
                ["Get the fuel.", "Lock the door.", "Run for the tram!", "It's right behind you.", "Don't get caught in the rain.", "Hear that bug zapper?"],
                ["Barricade the windows before nightfall.", "That thing is perfectly mimicking my voice.", "We need to find the specific spare parts.", "Its voice sounds distorted, like a fan.", "Is everyone accounted for on the tram?", "Double-check the supplies manifest."],
                ["Its voice is unnervingly high-pitched, like helium.", "The psychological ramifications of this paranoia are severe.", "That creature's anatomy is incomprehensibly horrifying.", "Meticulously search for any signs of sabotage.", "The tram's chronometer needs immediate synchronization.", "Its guttural chittering is growing exponentially louder."]
            ]
        },
        'fr': {
            langCode: 'fr-FR',
            nativeName: 'Français',
            flag: '🇫🇷',
            instructionText: 'Dites la phrase maintenant',
            micErrorText: "Vous avez besoin d'un microphone fonctionnel pour jouer",
            listeningText: 'Écoute...',
            words: [
                ["Prends le carburant.", "Verrouille la porte.", "Courez vers le tram !", "C'est juste derrière toi.", "Ne te fais pas surprendre par la pluie.", "Tu entends cette tapette à insectes ?"],
                ["Barricadez les fenêtres avant la nuit.", "Cette chose imite ma voix à la perfection.", "Nous devons trouver les pièces de rechange spécifiques.", "Sa voix semble déformée, comme par un ventilateur.", "Tout le monde est-il présent dans le tram ?", "Vérifiez à nouveau le manifeste des provisions."],
                ["Sa voix est étrangement aiguë, comme de l'hélium.", "Les ramifications psychologiques de cette paranoïa sont graves.", "L'anatomie de cette créature est incompréhensiblement horrifiante.", "Cherchez méticuleusement tout signe de sabotage.", "Le chronomètre du tram a besoin d'une synchronisation immédiate.", "Son caquetage guttural devient exponentiellement plus fort."]
            ]
        },
        'it': {
            langCode: 'it-IT',
            nativeName: 'Italiano',
            flag: '🇮🇹',
            instructionText: 'Di la frase ora',
            micErrorText: 'Hai bisogno di un microfono funzionante per giocare',
            listeningText: 'In ascolto...',
            words: [
                ["Prendi il carburante.", "Chiudi la porta.", "Corri al tram!", "È proprio dietro di te.", "Non farti prendere dalla pioggia.", "Senti quella zanzariera elettrica?"],
                ["Barrica le finestre prima che faccia notte.", "Quella cosa sta imitando perfettamente la mia voce.", "Dobbiamo trovare i pezzi di ricambio specifici.", "La sua voce suona distorta, come da un ventilatore.", "Ci sono tutti sul tram?", "Ricontrolla la lista delle scorte."],
                ["La sua voce è stranamente acuta, come l'elio.", "Le ramificazioni psicologiche di questa paranoia sono gravi.", "L'anatomia di quella creatura è incomprensibilmente terrificante.", "Cerca meticolosamente ogni segno di sabotaggio.", "Il cronometro del tram necessita di una sincronizzazione immediata.", "Il suo chiocciare gutturale sta crescendo esponenzialmente."]
            ]
        },
        'de': {
            langCode: 'de-DE',
            nativeName: 'Deutsch',
            flag: '🇩🇪',
            instructionText: 'Sag den Satz jetzt',
            micErrorText: 'Du benötigst ein funktionierendes Mikrofon zum Spielen',
            listeningText: 'Höre zu...',
            words: [
                ["Hol den Treibstoff.", "Schließ die Tür ab.", "Lauf zur Straßenbahn!", "Es ist direkt hinter dir.", "Lass dich nicht vom Regen erwischen.", "Hörst du diesen Insektenvernichter?"],
                ["Verbarrikadiere die Fenster vor Einbruch der Nacht.", "Dieses Ding ahmt meine Stimme perfekt nach.", "Wir müssen die spezifischen Ersatzteile finden.", "Seine Stimme klingt verzerrt, wie durch einen Ventilator.", "Sind alle in der Straßenbahn vollzählig?", "Überprüfe die Vorratsliste doppelt."],
                ["Seine Stimme ist beunruhigend hoch, wie von Helium.", "Die psychologischen Auswirkungen dieser Paranoia sind schwerwiegend.", "Die Anatomie dieser Kreatur ist unbegreiflich schrecklich.", "Suche akribisch nach Anzeichen von Sabotage.", "Das Chronometer der Straßenbahn muss sofort synchronisiert werden.", "Sein kehliges Gackern wird exponentiell lauter."]
            ]
        },
        'es': {
            langCode: 'es-ES',
            nativeName: 'Español',
            flag: '🇪🇸',
            instructionText: 'Di la frase ahora',
            micErrorText: 'Necesitas un micrófono que funcione para jugar',
            listeningText: 'Escuchando...',
            words: [
                ["Coge el combustible.", "Cierra la porta.", "¡Corre hacia el tranvía!", "Está justo detrás de ti.", "Que no te pille la lluvia.", "¿Oyes ese matamoscas eléctrico?"],
                ["Atrinchera las ventanas antes del anochecer.", "Esa cosa está imitando mi voz perfettamente.", "Necesitamos encontrar los repuestos específicos.", "Su voz suena distorsionada, como por un ventilador.", "¿Están todos contados en el tranvía?", "Verifica de nuevo el manifiesto de suministros."],
                ["Su voz es inquietantemente aguda, como de helio.", "Las ramificazioni psicologiche di questa paranoia sono graves.", "La anatomía de esa criatura es incomprensiblemente horrenda.", "Busca meticulosamente cualquier señal de sabotaje.", "El cronómetro del tranvía necesita sincronización inmediata.", "Su graznido gutural crece exponencialmente."]
            ]
        },
        'pt': {
            langCode: 'pt-BR',
            nativeName: 'Português',
            flag: '🇧🇷',
            instructionText: 'Diga a frase agora',
            micErrorText: 'Você precisa de um microfone funcional para jogar',
            listeningText: 'Ouvindo...',
            words: [
                ["Pegue o combustível.", "Tranque a porta.", "Corra para o bonde!", "Está logo atrás de você.", "Não seja pego pela chuva.", "Ouve esse mata-moscas?"],
                ["Barricade as janelas antes do anoitecer.", "Aquela coisa está imitando minha voz perfeitamente.", "Precisamos encontrar as peças de reposição específicas.", "A voz dele soa distorsionada, como por um ventilador.", "Todos estão presentes no bonde?", "Verifique novamente o manifesto de suprimentos."],
                ["A voz dele é perturbadoramente aguda, como hélio.", "As ramificações psicológicas desta paranoia sono severas.", "A anatomia daquela criatura é incompreensivelmente horrível.", "Procure meticulosamente por quaisquer sinais de sabotagem.", "O cronômetro do bonde precisa de sincronização imediata.", "Seu grasnido gutural está crescendo exponencialmente."]
            ]
        },
        'ru': {
            langCode: 'ru-RU',
            nativeName: 'Русский',
            flag: '🇷🇺',
            instructionText: 'Произнесите фразу сейчас',
            micErrorText: 'Вам нужен работающий микрофон для игры',
            listeningText: 'Слушаю...',
            words: [
                ["Возьми топливо.", "Запри дверь.", "Беги к трамваю!", "Оно прямо за тобой.", "Не попади под дождь.", "Слышишь эту мухобойку?"],
                ["Забаррикадируй окна до наступления ночи.", "Эта тварь идеально имитирует мой голос.", "Нам нужно найти особые запчасти.", "Его голос звучит искаженно, как через вентилятор.", "Все на месте в трамвае?", "Перепроверь список припасов."],
                ["Его голос неестественно высокий, будто от гелия.", "Психологические последствия этой паранойи серьезны.", "Анатомия этого существа непостижимо ужасна.", "Тщательно ищите любые признаки саботажа.", "Хронометр трамвая нуждается в немедленной синхронизации.", "Его гортанное стрекотание становится экспоненциально громче."]
            ]
        },
        'zh': {
            langCode: 'cmn-Hans-CN',
            nativeName: '中文',
            flag: '🇨🇳',
            instructionText: '现在说出这句话',
            micErrorText: '你需要一个可用的麦克风来玩这个游戏',
            listeningText: '正在听...',
            words: [
                ["去拿燃料。", "锁上门。", "快跑向电车！", "它就在你后面。", "别被雨淋到。", "听到那个灭蚊灯了吗？"],
                ["天黑前把窗户堵上。", "那东西在完美地模仿我的声音。", "我们需要找到特定的备用零件。", "它的声音听起来很失真，像风扇一样。", "电车上的人都到齐了吗？", "再检查一遍补给清单。"],
                ["它的声音尖得吓人，像是吸了氦气。", "这种偏执的心理后果是严重的。", "那个生物的构造真是难以理解的可怕。", "一丝不苟地寻找任何蓄意破坏的迹象。", "电车的计时器需要立即同步。", "它喉咙里的咯咯声正以指数级增长。"]
            ]
        },
        'ja': {
            langCode: 'ja-JP',
            nativeName: '日本語',
            flag: '🇯🇵',
            instructionText: '今、文章を言ってください',
            micErrorText: 'このゲームをプレイするにはマイクが必要です',
            listeningText: '聞き取り中...',
            words: [
                ["燃料を持て！","ドアをロックしろ！","トラムへ急げ！","後ろだ！そいつがいる！","雨に打たれるな！","電撃殺虫器の音、聞こえるか？"],
                ["夜になる前に窓を塞げ！","あれは俺の声を完全に真似てる！","ぴったりのスペアパーツを見つけろ！","声がファンみたいに歪んで聞こえる！","トラムの中に全員いるか？","物資リストを確認しろ！"],
                ["声がヘリウムみたいに不気味に高い！","被害妄想がひどい！深刻すぎる！","あの化け物…どうなってるのか分からない！怖い！","破壊工作の痕跡を探せ！","トラムのクロノメーター、今すぐ同期しろ！","喉のカタカタ音がどんどん大きくなってる！"]
            ]
        },
        'ko': {
            langCode: 'ko-KR',
            nativeName: '한국어',
            flag: '🇰🇷',
            instructionText: '이제 문장을 말하세요',
            micErrorText: '이 게임을 하려면 마이크가 필요합니다',
            listeningText: '듣는 중...',
            words: [
                ["연료 가져와.", "문 잠가주세요.", "트램으로 달려!", "바로 네 뒤에 있어.", "절대 비 맞지 마.", "저 전기 모기채 소리 들려?"],
                ["밤이 되기 전에 창문을 막아.", "저것이 내 목소리를 완벽하게 흉내 내고 있어.", "우리는 특정 예비 부품을 찾아야 해.", "그것의 목소리가 선풍기처럼 왜곡되어 들려.", "트램에 모두 탔는지 확인해", "보급품 목록을 다시 확인해봐."],
                ["저것의 목소리는 헬륨처럼 섬뜩하게 높아.", "편집증의 심리적 파장은 심각하다.", "저 생물의 해부학적 구조는 이해할 수 없을 정도로 끔찍해.", "파괴 행위의 징후를 꼼꼼히 찾아봐.", "전차의 크로노미터는 즉각적인 동기화가 필요해.", "그것의 목구멍에서 나는 깔깔거리는 소리가 기하급수적으로 커지고 있어."]
            ]
        }
    };

    let languageButtons = [];

    p.preload = function() {
        console.log("Pronunciation Game: preload()");
        
        // Detect mobile
        isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        try {
            characterImgIdle = p.loadImage(characterImageUrl,
                (img) => {
                    console.log("Character image loaded");
                    if (img.height > 0) characterAspectRatio = img.width / img.height;
                },
                (err) => {
                    console.error("Failed to load character image:", err);
                    gameState = 'preload_error';
                }
            );

            fallbackBgImg = p.loadImage("src/ui/BG.png",
                () => console.log("Background loaded"),
                (err) => console.error("Failed to load background:", err)
            );

        } catch (e) {
            console.error("Preload Exception", e);
            gameState = 'preload_error';
        }
    };

    p.setup = function() {
        console.log("Pronunciation Game: setup()");

        // Mobile-optimized canvas sizing
        const aspectRatio = 9 / 16;
        let canvasHeight = p.windowHeight;
        let canvasWidth = canvasHeight * aspectRatio;
        
        // Ensure canvas fits within window width on mobile
        if (canvasWidth > p.windowWidth) {
            canvasWidth = p.windowWidth;
            canvasHeight = canvasWidth / aspectRatio;
        }
        
        p.createCanvas(canvasWidth, canvasHeight);

        // Prevent mobile scroll during game
        if (isMobile) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.height = '100%';
        }

        if (gameState === 'preload_error') {
            displayPreloadError();
            return;
        }
        
        if (gameState === 'SELECT_LANGUAGE') {
            setupLanguageSelection();
        }
    };

    function displayPreloadError() {
        // Gradient background
        for (let i = 0; i <= p.height; i++) {
            let inter = p.map(i, 0, p.height, 0, 1);
            let c = p.lerpColor(p.color(20, 20, 40), p.color(60, 20, 80), inter);
            p.stroke(c);
            p.line(0, i, p.width, i);
        }
        
        p.fill(255, 100, 100);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(isMobile ? 18 : 20);
        p.text("Error loading game assets.\nPlease refresh the page.", p.width / 2, p.height / 2);
        p.noLoop();
    }
    
    function setupLanguageSelection() {
        languageButtons = [];
        const languages = Object.keys(languageData);
        const buttonHeight = p.height * (isMobile ? 0.055 : 0.06);
        const buttonWidth = p.width * (isMobile ? 0.85 : 0.75);
        const buttonSpacing = p.height * 0.02;
        const totalHeight = languages.length * (buttonHeight + buttonSpacing);
        let startY = p.constrain((p.height - totalHeight) / 2, 100, p.height);

        languages.forEach((langKey, index) => {
            let lang = languageData[langKey];
            languageButtons.push({
                x: p.width / 2 - buttonWidth / 2,
                y: startY + index * (buttonHeight + buttonSpacing),
                w: buttonWidth,
                h: buttonHeight,
                text: lang.nativeName,
                flag: lang.flag,
                langCode: lang.langCode,
                langKey: langKey,
                hover: false,
                scale: 1
            });
        });
    }

    async function initializeGame(langCode, langKey) {
        console.log(`Initializing game for language: ${langCode}`);
        chosenLang = langCode;

        // Set translated text
        instructionText = languageData[langKey].instructionText;
        micErrorText = languageData[langKey].micErrorText;
        listeningText = languageData[langKey].listeningText;

        // Load language-specific libraries
        try {
            if (langCode === 'cmn-Hans-CN') {
                feedbackMessage = "Loading Chinese library...";
                await loadScript("https://cdn.jsdelivr.net/npm/pinyin/dist/pinyin.js");
            } else if (langCode === 'ja-JP' && !kuroshiroInstance) {
                feedbackMessage = "Loading Japanese library...";
                await Promise.all([
                    loadScript("https://cdn.jsdelivr.net/npm/kuroshiro@1.2.0/dist/kuroshiro.min.js"),
                    loadScript("https://cdn.jsdelivr.net/npm/kuroshiro-analyzer-kuromoji@1.1.0/dist/kuroshiro-analyzer-kuromoji.min.js")
                ]);
                
                feedbackMessage = "Initializing Japanese dictionary...";
                kuroshiroInstance = new Kuroshiro.default();
                await kuroshiroInstance.init(new KuromojiAnalyzer({
                    dictPath: "./dict/" 
                }));
            }
            feedbackMessage = "";
        } catch (error) {
            console.error("Failed to load language library:", error);
            feedbackMessage = "Error loading library";
            return;
        }

        calculateLayout();

        p.textAlign(p.CENTER, p.CENTER);
        p.imageMode(p.CENTER);

        // Setup character animation
        let existingGif = document.getElementById('walk-gif');
        if (existingGif) existingGif.remove();
        characterWalkGif = p.createImg(characterWalkGifUrl, 'walking character');
        characterWalkGif.id('walk-gif');
        characterWalkGif.style('position', 'absolute');
        characterWalkGif.style('image-rendering', 'pixelated');
        characterWalkGif.style('pointer-events', 'none');
        characterWalkGif.hide();

        setupSpeechRecognition();
        wordColor = p.color(255);

        // Reset game state
        currentRound = 0;
        currentWordInRound = 0;
        targetWord = '';
        scoreSaved = false;
        characterState = 'idle';
        wallVisible = true;
        isListening = false;
        gameState = 'START_ROUND';
        
        // Start UI fade-in animation
        uiAlpha = 0;
        targetUiAlpha = 255;
    }

    p.windowResized = function() {
        const aspectRatio = 9 / 16;
        let canvasHeight = p.windowHeight;
        let canvasWidth = canvasHeight * aspectRatio;
        
        if (canvasWidth > p.windowWidth) {
            canvasWidth = p.windowWidth;
            canvasHeight = canvasWidth / aspectRatio;
        }
        
        p.resizeCanvas(canvasWidth, canvasHeight);
        calculateLayout();
        
        if (gameState === 'SELECT_LANGUAGE') {
            setupLanguageSelection();
        }
    }

    function calculateLayout() {
        // Adjust sizes for mobile
        const mobileFactor = isMobile ? 0.85 : 1;
        
        characterStartX = p.width * 0.15;
        characterY = p.height / 2;
        wallX = p.width / 2;
        characterHeight = desiredCharacterHeight * mobileFactor;

        if (characterImgIdle && characterImgIdle.height > 0) {
            characterAspectRatio = characterImgIdle.width / characterImgIdle.height;
            characterWidth = characterHeight * characterAspectRatio;
        } else {
            characterWidth = characterHeight;
        }
        
        wallHeight = characterHeight * 1.5;
        wallWidth = 60 * mobileFactor;

        playAreaW = p.width * 0.85;
        playAreaH = wallHeight * 1.8;
        playAreaX = (p.width - playAreaW) / 2;
        playAreaY = p.height / 2 - playAreaH / 2;
    }

    p.draw = function() {
        // Animated gradient background
        drawAnimatedBackground();
        p.clear();
        p.background(0, 0, 0, 128);
        
        // Update animations
        pulseAnimation = (pulseAnimation + 0.05) % (2 * p.PI);
        starAnimation = (starAnimation + 0.02) % (2 * p.PI);
        wallGlowAnimation = (wallGlowAnimation + 0.03) % (2 * p.PI);
        
        // Smooth UI transitions
        uiAlpha = p.lerp(uiAlpha, targetUiAlpha, 0.1);
        
        if (!gameState || gameState === 'unloaded' || gameState === 'preload_error') {
            return;
        }

        if (gameState !== 'SELECT_LANGUAGE') {
            // Draw play area vignette
            drawPlayAreaVignette();
            
            // Draw game elements
            drawWall();
            drawCharacter();
            updateParticles();

            if (!speechApiSupported && p.frameCount > 60 && gameState !== 'MIC_ERROR') {
                displayApiNotSupported();
                return;
            }

            // Update timer
            if (gameState === 'LISTENING' || gameState === 'SHOW_RESULT' || gameState === 'ANIMATING_FAILURE') {
                if (roundStartTime) {
                    let elapsed = (p.millis() - roundStartTime) / 1000;
                    roundTimer = p.max(0, ROUND_DURATION_SECONDS - elapsed);
                    if (roundTimer <= 0 && gameState !== 'GAME_OVER') {
                        feedbackMessage = "Time's up!";
                        gameState = 'GAME_OVER';
                    }
                }
            }

            if (gameState === 'ANIMATING_SUCCESS' || gameState === 'ANIMATING_FAILURE') {
                updateCharacterPosition();
            }
            displayUiText();
        }

        // Handle game states
        switch (gameState) {
            case 'SELECT_LANGUAGE':
                drawLanguageSelectionScreen();
                break;
            case 'MIC_ERROR':
                displayMicError();
                p.noLoop();
                break;
            case 'START_ROUND':
                wallVisible = true;
                characterX = characterStartX;
                characterState = 'idle';
                if (characterWalkGif) characterWalkGif.hide();
                if (!targetWord) {
                    selectWordForRound();
                }
                if (targetWord) {
                    roundStartTime = p.millis();
                    roundTimer = ROUND_DURATION_SECONDS;
                    gameState = 'LISTENING';
                    startListening();
                } else if (currentRound >= totalRounds) {
                    gameState = 'GAME_OVER';
                }
                break;
            case 'SHOW_RESULT':
                if (characterWalkGif) characterWalkGif.hide();
                break;
            case 'ANIMATING_SUCCESS':
                createSuccessParticles();
            case 'ANIMATING_FAILURE':
                break;
            case 'GAME_OVER':
                if (characterWalkGif) characterWalkGif.hide();
                if (isListening && recognition) {
                    try { recognition.stop(); } catch (e) {}
                    isListening = false;
                }
                if (!scoreSaved) {
                    finalScore = currentRound * 10;
                    const gameSalt = sessionStorage.getItem('currentGameSalt');
                    const scoreEvent = new CustomEvent('gameComplete', {
                        detail: {
                            gameId: GAME_ID, 
                            score: score, 
                            salt: gameSalt 
                        }
                    });
                    window.dispatchEvent(scoreEvent);
                    scoreSaved = true;
                    console.log(`Saved score: ${finalScore}`);
                }
                break;
        }
    };

    function drawAnimatedBackground() {
        // Create animated gradient background
        for (let i = 0; i <= p.height; i += 5) {
            let inter = p.map(i, 0, p.height, 0, 1);
            let offset = p.sin(starAnimation + i * 0.01) * 0.1;
            let c = p.lerpColor(
                p.color(20 + offset * 20, 25, 45),
                p.color(45, 20 + offset * 10, 85),
                inter
            );
            p.noStroke();
            p.fill(c);
            p.rect(0, i, p.width, 5);
        }
        
        // Add subtle stars
        p.push();
        p.randomSeed(42);
        for (let i = 0; i < 30; i++) {
            let x = p.random(p.width);
            let y = p.random(p.height);
            let brightness = p.sin(starAnimation * (1 + i * 0.1)) * 127 + 128;
            p.fill(255, 255, 255, brightness * 0.3);
            p.noStroke();
            p.ellipse(x, y, 2);
        }
        p.pop();
    }

    function drawPlayAreaVignette() {
        // Smooth vignette effect around play area
        let gradient = p.drawingContext.createRadialGradient(
            p.width / 2, p.height / 2, 0,
            p.width / 2, p.height / 2, p.width * 0.7
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
        p.drawingContext.fillStyle = gradient;
        p.drawingContext.fillRect(0, 0, p.width, p.height);
    }
    
    function drawLanguageSelectionScreen() {
        p.textAlign(p.CENTER, p.CENTER);
        
        // Animated title
        let titleY = p.height * 0.08;
        let titleSize = p.width * (isMobile ? 0.065 : 0.08);
        
        // Title glow effect
        p.fill(255, 255, 255, 30);
        p.textSize(titleSize * 1.1);
        p.text("Select Your Language", p.width / 2, titleY);
        
        p.fill(255);
        p.textSize(titleSize);
        p.text("Select Your Language", p.width / 2, titleY);
        
        // Subtitle
        p.fill(200, 200, 255, 200);
        p.textSize(titleSize * 0.3);
        p.text("Choose your preferred language to continue", p.width / 2, titleY + 30);

        // Draw language buttons with hover effects
        languageButtons.forEach((btn, index) => {
            p.push();
            
            // Hover detection
            let isHovering = p.mouseX > btn.x && p.mouseX < btn.x + btn.w &&
                           p.mouseY > btn.y && p.mouseY < btn.y + btn.h;
            
            // Smooth scale animation
            btn.scale = p.lerp(btn.scale, isHovering ? 1.05 : 1, 0.2);
            btn.hover = isHovering;
            
            // Button shadow
            if (isHovering) {
                p.fill(0, 0, 0, 50);
                p.noStroke();
                p.rect(btn.x + 3, btn.y + 3, btn.w, btn.h, 20);
            }
            
            // Button gradient
            let btnColor1 = isHovering ? p.color(80, 150, 250) : p.color(60, 120, 200);
            let btnColor2 = isHovering ? p.color(100, 180, 255) : p.color(80, 140, 220);
            
            // Draw gradient button
            for (let i = 0; i < btn.h; i++) {
                let inter = p.map(i, 0, btn.h, 0, 1);
                let c = p.lerpColor(btnColor1, btnColor2, inter);
                p.stroke(c);
                p.line(btn.x, btn.y + i, btn.x + btn.w, btn.y + i);
            }
            
            // Button border
            p.noFill();
            p.stroke(255, 255, 255, isHovering ? 200 : 100);
            p.strokeWeight(2);
            p.rect(btn.x, btn.y, btn.w, btn.h, 20);
            
            // Flag and text
            p.fill(255);
            p.noStroke();
            p.textSize(btn.h * 0.5);
            p.text(btn.flag, btn.x + btn.w * 0.15, btn.y + btn.h / 2);
            
            p.textSize(btn.h * 0.35);
            p.text(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
            
            // Add pulse effect on hover
            if (isHovering) {
                let pulse = p.sin(p.frameCount * 0.1) * 5 + 5;
                p.noFill();
                p.stroke(255, 255, 255, 50);
                p.strokeWeight(1);
                p.rect(btn.x - pulse/2, btn.y - pulse/2, btn.w + pulse, btn.h + pulse, 20);
            }
            
            p.pop();
        });
    }
    
    // Touch support for mobile
    p.touchStarted = function() {
        if (isMobile) {
            handleInteraction(p.touches[0].x, p.touches[0].y);
            return false; // Prevent default
        }
    }
    
    p.mousePressed = function() {
        if (!isMobile) {
            handleInteraction(p.mouseX, p.mouseY);
        }
    }
    
    function handleInteraction(x, y) {
        if (gameState === 'SELECT_LANGUAGE') {
            languageButtons.forEach(btn => {
                if (x > btn.x && x < btn.x + btn.w &&
                    y > btn.y && y < btn.y + btn.h) {
                    // Visual feedback
                    btn.scale = 0.95;
                    initializeGame(btn.langCode, btn.langKey);
                }
            });
        }
    }

    // Add this new function to your script
    function shuffleArray(array) {
        // Create a copy to avoid modifying the original data
        let newArray = array.slice(); 
        for (let i = newArray.length - 1; i > 0; i--) {
            // Pick a random index from 0 to i
            const j = Math.floor(Math.random() * (i + 1));
            // Swap elements
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    function displayUiText() {
        p.push();
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);

        if (gameState !== 'GAME_OVER') {
            // Round info with better styling
            let infoBoxY = 50;
            
            // Info box background
            p.fill(0, 0, 0, 100);
            p.noStroke();
            p.rect(p.width/2 - 150, infoBoxY - 20, 300, 35, 15);
            
            p.fill(255, 255, 255, uiAlpha);
            p.textSize(isMobile ? 20 : 24);
            p.text(`Round ${currentRound + 1}/${totalRounds} • Sentence ${currentWordInRound + 1}/${WORDS_PER_ROUND}`, 
                   p.width / 2, infoBoxY);

            // Timer with warning animation
            let timerColor = roundTimer <= 5 ? 
                p.color(255, 100 + p.sin(pulseAnimation * 3) * 55, 100) : 
                p.color(255, 255, 255, uiAlpha);
            
            // Timer background circle
            p.fill(0, 0, 0, 100);
            p.noStroke();
            p.ellipse(p.width - 40, 40, 60);
            
            // Timer progress arc
            p.noFill();
            p.stroke(timerColor);
            p.strokeWeight(3);
            p.arc(p.width - 40, 40, 60, 60, -p.PI/2, 
                 -p.PI/2 + (roundTimer/ROUND_DURATION_SECONDS) * 2 * p.PI);
            
            // Timer text
            p.fill(timerColor);
            p.noStroke();
            p.textSize(20);
            p.text(Math.ceil(roundTimer), p.width - 40, 40);
        }

        // Target word display with enhanced styling
        if (gameState !== 'GAME_OVER' && targetWord) {
            let wordBoxY = p.height * 0.35;
            let boxWidth = p.width * (isMobile ? 0.9 : 0.8);
            let boxHeight = isMobile ? 100 : 120;
            
            // Glowing box effect
            if (gameState === 'LISTENING') {
                let glowSize = 10 + p.sin(pulseAnimation) * 5;
                p.fill(100, 150, 255, 30);
                p.noStroke();
                p.rect(p.width/2 - boxWidth/2 - glowSize, wordBoxY - boxHeight/2 - glowSize, 
                      boxWidth + glowSize*2, boxHeight + glowSize*2, 25);
            }
            
            // Main box
            p.fill(0, 0, 0, 180);
            p.noStroke();
            p.rect(p.width/2 - boxWidth/2, wordBoxY - boxHeight/2, boxWidth, boxHeight, 20);
            
            // Border
            p.noFill();
            p.stroke(wordColor);
            p.strokeWeight(2);
            p.rect(p.width/2 - boxWidth/2, wordBoxY - boxHeight/2, boxWidth, boxHeight, 20);
            
            // Word text
            p.fill(wordColor);
            p.noStroke();
            p.textSize(isMobile ? 24 : 32);
            let formattedText = formatTextForWrapping(targetWord, boxWidth * 0.9, chosenLang);
            p.text(formattedText, p.width / 2, wordBoxY);
        }

        // Feedback message with animation
        if (feedbackMessage) {
            let msgY = p.height * 0.65;
            let msgBoxWidth = p.width * (isMobile ? 0.95 : 0.9);
            
            // Message box with gradient
            p.push();
            let gradient = p.drawingContext.createLinearGradient(
                p.width/2 - msgBoxWidth/2, msgY - 40,
                p.width/2 + msgBoxWidth/2, msgY + 40
            );
            gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
            gradient.addColorStop(0.5, 'rgba(0,0,0,0.8)');
            gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
            p.drawingContext.fillStyle = gradient;
            p.drawingContext.fillRect(p.width/2 - msgBoxWidth/2, msgY - 40, msgBoxWidth, 80);
            p.pop();
            
            // Message text
            p.fill(255, 255, 255, uiAlpha);
            p.textSize(isMobile ? 24 : 28);
            let formattedFeedback = formatTextForWrapping(feedbackMessage, msgBoxWidth * 0.95, chosenLang);
            p.text(formattedFeedback, p.width / 2, msgY);
        }

        // Game over screen with celebration
        if (gameState === 'GAME_OVER') {
            // Dark overlay
            p.fill(0, 0, 0, 150);
            p.noStroke();
            p.rect(0, 0, p.width, p.height);
            
            // Success box
            let boxY = p.height / 2;
            let boxSize = p.width * 0.8;
            
            // Animated glow
            for (let i = 3; i > 0; i--) {
                p.fill(100, 255, 100, 20 / i);
                p.noStroke();
                p.rect(p.width/2 - boxSize/2 - i*10, boxY - 100 - i*10, 
                      boxSize + i*20, 200 + i*20, 30);
            }
            
            // Main box
            p.fill(20, 60, 20, 240);
            p.stroke(100, 255, 100);
            p.strokeWeight(3);
            p.rect(p.width/2 - boxSize/2, boxY - 100, boxSize, 200, 25);
            
            // Success text
            p.fill(100, 255, 100);
            p.noStroke();
            p.textSize(isMobile ? 30 : 40);
            p.text("Verification\nComplete!", p.width / 2, boxY - 20);
            
            // Score
            p.fill(255);
            p.textSize(isMobile ? 18 : 20);
            p.text(`Final Score: ${finalScore}`, p.width / 2, boxY + 40);
            
            p.fill(200);
            p.textSize(isMobile ? 14 : 16);
            p.text("You can now close this window", p.width / 2, boxY + 70);
            
            p.noLoop();
        }
        p.pop();
    }
    
    function displayMicError() {
        p.push();
        
        // Error box with red theme
        let boxWidth = p.width * 0.9;
        let boxY = p.height / 2;
        
        // Red glow
        p.fill(255, 0, 0, 30);
        p.noStroke();
        p.rect(p.width/2 - boxWidth/2 - 10, boxY - 60, boxWidth + 20, 120, 20);
        
        // Main box
        p.fill(50, 0, 0, 230);
        p.stroke(255, 100, 100);
        p.strokeWeight(2);
        p.rect(p.width/2 - boxWidth/2, boxY - 50, boxWidth, 100, 15);
        
        // Error icon
        p.fill(255, 100, 100);
        p.textSize(30);
        p.text("⚠", p.width / 2, boxY - 20);
        
        // Error message
        p.fill(255);
        p.textSize(isMobile ? 18 : 20);
        p.text(micErrorText, p.width / 2, boxY + 10);
        
        p.pop();
    }

    function drawWall() {
        if (wallVisible) {
            let wallDrawY = p.constrain(p.height / 2, playAreaY + wallHeight / 2, 
                                       playAreaY + playAreaH - wallHeight / 2);
            
            // Wall glow effect
            if (gameState === 'LISTENING') {
                let glowIntensity = p.sin(wallGlowAnimation) * 20 + 30;
                p.fill(150, 100, 200, glowIntensity);
                p.noStroke();
                p.rect(wallX - wallWidth/2 - 10, wallDrawY - wallHeight/2 - 10, 
                      wallWidth + 20, wallHeight + 20, 10);
            }
            
            // Main wall with gradient
            p.push();
            let gradient = p.drawingContext.createLinearGradient(
                wallX - wallWidth/2, wallDrawY - wallHeight/2,
                wallX + wallWidth/2, wallDrawY + wallHeight/2
            );
            gradient.addColorStop(0, 'rgba(40,40,60,0.9)');
            gradient.addColorStop(0.5, 'rgba(20,20,40,1)');
            gradient.addColorStop(1, 'rgba(40,40,60,0.9)');
            p.drawingContext.fillStyle = gradient;
            p.drawingContext.fillRect(wallX - wallWidth/2, wallDrawY - wallHeight/2, 
                                     wallWidth, wallHeight);
            p.pop();
            
            // Wall border
            p.noFill();
            p.stroke(100, 100, 150, 200);
            p.strokeWeight(2);
            p.rect(wallX - wallWidth/2, wallDrawY - wallHeight/2, wallWidth, wallHeight, 5);
        }
    }

    function drawCharacter() {
        characterY = p.constrain(characterY, playAreaY + characterHeight / 2, 
                                playAreaY + playAreaH - characterHeight / 2);
        let currentDisplayWidth = (characterAspectRatio > 0) ? 
            characterHeight * characterAspectRatio : characterWidth;
        
        // Character shadow
        p.fill(0, 0, 0, 100);
        p.noStroke();
        p.ellipse(characterX, characterY + characterHeight/2, currentDisplayWidth * 0.8, 10);
        
        // Draw character based on state
        if (characterState === 'idle' || characterState === 'returning') {
            if (characterWalkGif) characterWalkGif.hide();
            if (characterImgIdle) {
                // Add slight bounce animation when idle
                let bounce = p.sin(p.frameCount * 0.05) * 2;
                p.image(characterImgIdle, characterX, characterY + bounce, 
                       currentDisplayWidth, characterHeight);
            }
        } else if (characterState === 'walking' || characterState === 'walking_correct') {
            if (characterWalkGif) {
                characterWalkGif.show();
                let canvasElement = p.canvas;
                if (!canvasElement) return;
                let rect = canvasElement.getBoundingClientRect();
                characterWalkGif.style('height', `${characterHeight}px`);
                characterWalkGif.style('width', 'auto');
                let gifWidth = characterWalkGif.width;
                characterWalkGif.position(
                    rect.left + window.scrollX + characterX - (gifWidth / 2),
                    rect.top + window.scrollY + characterY - (characterHeight / 2)
                );
            } else if (characterImgIdle) {
                p.image(characterImgIdle, characterX, characterY, 
                       currentDisplayWidth, characterHeight);
            }
        }
        characterWidth = currentDisplayWidth;
    }

    function createSuccessParticles() {
        if (successParticles.length === 0 && characterState === 'walking_correct') {
            for (let i = 0; i < 20; i++) {
                successParticles.push({
                    x: characterX,
                    y: characterY,
                    vx: p.random(-5, 5),
                    vy: p.random(-8, -2),
                    size: p.random(3, 8),
                    color: p.color(p.random(100, 255), p.random(200, 255), p.random(100, 255)),
                    life: 255
                });
            }
        }
    }

    function updateParticles() {
        for (let i = successParticles.length - 1; i >= 0; i--) {
            let particle = successParticles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.3; // gravity
            particle.life -= 5;
            
            p.fill(p.red(particle.color), p.green(particle.color), 
                  p.blue(particle.color), particle.life);
            p.noStroke();
            p.ellipse(particle.x, particle.y, particle.size);
            
            if (particle.life <= 0) {
                successParticles.splice(i, 1);
            }
        }
    }

    function displayApiNotSupported() {
        p.push();
        let boxY = p.height * 0.7;
        
        p.fill(0, 0, 0, 200);
        p.stroke(255, 100, 100);
        p.strokeWeight(2);
        p.rect(p.width/2 - 200, boxY - 30, 400, 60, 15);
        
        p.fill(255, 100, 100);
        p.noStroke();
        p.textSize(isMobile ? 16 : 18);
        p.text("Speech Recognition not supported in this browser", p.width / 2, boxY);
        p.pop();
    }

    function selectWordForRound() {
        if (currentRound >= totalRounds) {
            targetWord = '';
            gameState = 'GAME_OVER';
            return;
        }

        if (currentWordInRound === 0) {
            const langKey = Object.keys(languageData).find(
                key => languageData[key].langCode === chosenLang
            );

            if (!langKey || !languageData[langKey].words[currentRound]) {
                targetWord = '';
                feedbackMessage = "Language data error!";
                wordColor = p.color(255, 0, 0);
                gameState = 'SHOW_RESULT';
                return;
            }

            const allSentencesForRound = languageData[langKey].words[currentRound];
            currentRoundWordList = shuffleArray(allSentencesForRound);
        }

        if (currentRoundWordList && currentRoundWordList.length > 0) {
            targetWord = currentRoundWordList.pop();
            feedbackMessage = instructionText;
            wordColor = p.color(255);
        }
    }

    function updateCharacterPosition() {
        let arrived = false;
        let distance = characterTargetX - characterX;
        
        if (p.abs(distance) < charSpeed) {
            characterX = characterTargetX;
            arrived = true;
        } else {
            characterX += (distance > 0 ? 1 : -1) * charSpeed;
        }

        if (arrived) {
            if (characterState === 'walking') {
                characterState = 'returning';
                characterTargetX = characterStartX;
            } else if (characterState === 'returning') {
                characterState = 'idle';
                feedbackMessage = instructionText;
                wordColor = p.color(255);
                gameState = 'LISTENING';
                startListening();
            } else if (characterState === 'walking_correct') {
                characterState = 'idle';
                currentWordInRound++;

                if (currentWordInRound >= WORDS_PER_ROUND) {
                    currentRound++;
                    currentWordInRound = 0;
                    targetWord = '';
                    feedbackMessage = '';
                    successParticles = [];
                    if (currentRound >= totalRounds) {
                        gameState = 'GAME_OVER';
                    } else {
                        gameState = 'START_ROUND';
                    }
                } else {
                    targetWord = '';
                    feedbackMessage = '';
                    successParticles = [];
                    selectWordForRound();
                    characterX = characterStartX;
                    characterTargetX = characterStartX;
                    wallVisible = true;
                    gameState = 'LISTENING';
                    startListening();
                }
            }
        }
    }

    async function checkAnswer(spoken) {
        if (!targetWord) return;

        const punctuationRegex = /[.,!?;:'"(){}\[\]\-\/\\`~@#$%^&*+=\|<>。、，「」『』？（）【】]/g;
        const processedSpoken = spoken.trim().replace(punctuationRegex, '');
        const processedTarget = targetWord.replace(punctuationRegex, '');
        let targetString, spokenString;

        // Language-specific processing
        if (chosenLang === 'cmn-Hans-CN') {
            if (typeof pinyin === 'undefined' || 
                (typeof pinyin !== 'function' && typeof pinyin.default !== 'function')) {
                console.error("Pinyin library not loaded");
                feedbackMessage = "Error: Pinyin library issue";
                isListening = false;
                return;
            }
            const pinyinFunc = typeof pinyin === 'function' ? pinyin : pinyin.default;
            spokenString = pinyinFunc(processedSpoken, { style: pinyin.STYLE_NORMAL }).flat().join(' ');
            targetString = pinyinFunc(processedTarget, { style: pinyin.STYLE_NORMAL }).flat().join(' ');
            
        } else if (chosenLang === 'ja-JP') {
            if (!kuroshiroInstance) {
                console.error("Kuroshiro not initialized");
                feedbackMessage = "Error: Japanese library not ready";
                return;
            }
            spokenString = await kuroshiroInstance.convert(processedSpoken, 
                { to: "romaji", romajiSystem: "hepburn" });
            targetString = await kuroshiroInstance.convert(processedTarget, 
                { to: "romaji", romajiSystem: "hepburn" });
            
        } else {
            spokenString = processedSpoken.toLowerCase().replace(/\s/g, '');
            targetString = processedTarget.toLowerCase().replace(/\s/g, '');
        }

        // Calculate similarity
        const distance = levenshteinDistance(spokenString, targetString);
        const maxLength = Math.max(spokenString.length, targetString.length);
        const similarity = maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
        
        console.log(`Similarity: ${similarity.toFixed(2)}`);
        let correct = similarity >= SIMILARITY_THRESHOLD;

        isListening = false;
        
        if (correct) {
            feedbackMessage = "Success! 🎉";
            wordColor = p.color(100, 255, 100);
            wallVisible = false;
            characterState = 'walking_correct';
            characterTargetX = wallX + characterWidth * 0.75;
            gameState = 'ANIMATING_SUCCESS';
        } else {
            feedbackMessage = "Try Again! 💪";
            wordColor = p.color(255, 100, 100);
            wallVisible = true;
            characterState = 'walking';
            characterTargetX = wallX - (wallWidth / 2) - (characterWidth / 2) - 5;
            gameState = 'ANIMATING_FAILURE';
        }
    }

    function setupSpeechRecognition() {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            speechApiSupported = true;
            recognition = new (window.SpeechRecognition || webkitSpeechRecognition)();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = chosenLang;
            
            recognition.onstart = () => {
                isListening = true;
                feedbackMessage = listeningText + " 🎤";
            };

            recognition.onresult = async (event) => {
                let spokenWord = event.results[0][0].transcript.trim();
                feedbackMessage = "Checking... 🔍";
                console.log(`Spoken: "${spokenWord}"`);
                await checkAnswer(spokenWord);
            };

            recognition.onerror = (event) => {
                isListening = false;
                
                if (event.error === 'audio-capture') {
                    console.error("No microphone found");
                    gameState = 'MIC_ERROR';
                    return;
                }

                if (event.error === 'no-speech') {
                    feedbackMessage = "Didn't hear that. Try again... 🔊";
                    wordColor = p.color(255, 200, 100);
                    gameState = 'SHOW_RESULT';
                    setTimeout(() => {
                        if (gameState === 'SHOW_RESULT' && currentRound < totalRounds) {
                            feedbackMessage = instructionText;
                            wordColor = p.color(255);
                            gameState = 'LISTENING';
                            startListening();
                        }
                    }, 2000);
                } else {
                    feedbackMessage = `Error: ${event.error}`;
                    wordColor = p.color(255, 0, 0);
                    gameState = 'SHOW_RESULT';
                }
            };
            
            recognition.onend = () => {
                isListening = false;
            };
        } else {
            speechApiSupported = false;
        }
    }

    function startListening() {
        if (!speechApiSupported || gameState === 'MIC_ERROR') return;
        
        if (recognition && !isListening && gameState === 'LISTENING') {
            try {
                recognition.start();
            } catch (e) {
                console.error("Error starting recognition:", e);
                isListening = false;
            }
        }
    }

    p.cleanup = function() {
        console.log("Cleaning up Pronunciation Game resources...");
        
        // Stop recognition
        if (recognition && isListening) {
            try { recognition.stop(); } catch (e) {}
        }
        recognition = null;
        isListening = false;
        
        // Remove GIF element
        if (characterWalkGif) {
            try { characterWalkGif.remove(); } catch (e) {}
        }
        characterWalkGif = null;
        
        // Reset mobile styles
        if (isMobile) {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
        }
        
        // Clear particles
        successParticles = [];
        
        // Reset state
        gameState = 'unloaded';
        scoreSaved = false;
    };
};