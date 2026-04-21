// ============================================================
//  M I M E S I S   P O N G
//  Ported from darkpong into a p5.js instance sketch.
//  Phases are stretched so reaching score 30 is doable (gold tier)
//  and the game caps at score 50 (MAX = TRANSCENDENCE).
// ============================================================

window.sketchMimesisPong = function(p) {
    // ---- Logical canvas coords (scaled by CSS to fit viewport) ----
    const W = 960;
    const H = 540;                   // 16:9
    const PADDLE_W = 16;
    const PADDLE_MARGIN = 28;        // horizontal inset so paddles aren't flush to screen edge
    const PADDLE_H_DEFAULT = 100;
    const BALL_R = 10;
    const BASE_BALL_SPEED = 6.44;   // +40% vs the previous 4.6
    const PLAYER_PADDLE_SPEED = 7;
    const MAX_SCORE = 50;

    // ---- Decoy palettes — doppelganger ball colors ----
    const DECOY_PALETTE_3 = [
        [255,  90, 100],   // red
        [120, 220, 140],   // green
        [110, 170, 255],   // blue
    ];
    const DECOY_PALETTE_5 = [
        [255,  90, 100],   // red
        [120, 220, 140],   // green
        [110, 170, 255],   // blue
        [255, 220,  90],   // yellow
        [205, 130, 255],   // purple
    ];

    // ---- Mimesis palette (darker, cooler than darkpong) ----
    const PALETTE = {
        bg:       [7, 6, 20],
        ball:     [230, 240, 255],
        player:   [116, 199, 236],   // accent blue from the event theme
        ai:       [243, 139, 168],   // muted red, "wrong" hue
        reversed: [255, 70, 90],
        trail:    [137, 180, 250],
        accent:   [169, 130, 255],
        grid:     [24, 20, 48],
        scanline: [0, 0, 0, 30],
    };

    // Phase map: score 0→50, stretched so doing 30 is achievable.
    // Signature gimmicks: DOPPELGANGER (decoy ball, phase 1), MIMICRY (fake paddle, phase 5).
    const PHASES = [
        { score:  0, name: 'SILENCE',         sub: 'It has not noticed you yet...',
            speedMult: 1.0,  wave: false, blink: false, reverse: false, paddleH: 100, multiBall: false, decoyBall: false, fakePaddle: false },
        { score:  4, name: 'DOPPELGANGER',    sub: 'It copies the ball. Trust only the white.',
            speedMult: 1.0,  wave: false, blink: false, reverse: false, paddleH: 100, multiBall: false, decoyBall: true,  fakePaddle: false },
        { score:  8, name: 'WHISPERS',        sub: 'Something is moving faster.',
            speedMult: 1.2,  wave: false, blink: false, reverse: false, paddleH: 100, multiBall: false, decoyBall: false, fakePaddle: false },
        { score: 12, name: 'DISTORTION',      sub: 'It bends the signal.',
            speedMult: 1.0,  wave: true,  blink: false, reverse: false, paddleH: 100, multiBall: false, decoyBall: false, fakePaddle: false },
        { score: 16, name: 'IT BLINKS',       sub: 'Now you see it, now you do not.',
            speedMult: 1.1,  wave: false, blink: true,  reverse: false, paddleH: 100, multiBall: false, decoyBall: false, fakePaddle: false },
        { score: 20, name: 'MIMICRY',         sub: 'It wears your shape.',
            speedMult: 1.1,  wave: false, blink: false, reverse: false, paddleH: 100, multiBall: false, decoyBall: false, fakePaddle: true  },
        { score: 24, name: 'REFLECTION',      sub: 'Your input is not yours.',
            speedMult: 1.1,  wave: false, blink: false, reverse: true,  paddleH: 100, multiBall: false, decoyBall: false, fakePaddle: false },
        { score: 28, name: 'DEEP DECEPTION',  sub: 'A false paddle. A false ball.',
            speedMult: 1.15, wave: false, blink: false, reverse: false, paddleH:  90, multiBall: false, decoyBall: true,  fakePaddle: true  },
        { score: 32, name: 'CLOSING IN',      sub: 'Its paddle shrinks yours.',
            speedMult: 1.2,  wave: false, blink: false, reverse: false, paddleH:  72, multiBall: false, decoyBall: false, fakePaddle: false },
        { score: 37, name: 'MADNESS',         sub: 'Everything wrong, all at once.',
            speedMult: 1.15, wave: true,  blink: false, reverse: true,  paddleH:  80, multiBall: false, decoyBall: true,  fakePaddle: false },
        { score: 41, name: 'DECOYS',          sub: 'Two targets. One is a lie. You are smaller now.',
            speedMult: 1.0,  wave: false, blink: false, reverse: false, paddleH:  72, multiBall: true,  decoyBall: true,  fakePaddle: false },
        { score: 46, name: 'THE VOID',        sub: 'All hope abandon.',
            speedMult: 1.3,  wave: true,  blink: true,  reverse: true,  paddleH:  68, multiBall: true,  decoyBall: true,  fakePaddle: true  },
        { score: 50, name: 'SURVIVOR',        sub: 'You have outlasted it.',
            speedMult: 1.0,  wave: false, blink: false, reverse: false, paddleH: 100, multiBall: false, decoyBall: false, fakePaddle: false },
    ];

    // -----------------------------------------------------------
    //  Intro slides — short, intriguing, translated to 12 langs.
    //  Detection: navigator.language → closest supported code.
    // -----------------------------------------------------------
    const INTRO_SLIDES = {
        'en':    [ "Finally, the safe area. No footsteps behind you, no whispers in the dark. For one long moment, you let yourself believe you are alone.",
                   "Something in the corner catches your eye — an old arcade cabinet, leaning against the wall. Its screen flickers, humming a tired orange. PONG.",
                   "You step closer. The air drops a degree. A breath lands on the back of your neck. The cabinet blinks awake, and the first ball drops." ],
        'ko':    [ "드디어 안전지대. 뒤따르는 발소리도, 어둠 속 속삭임도 없다. 잠시나마, 너는 혼자라고 믿어본다.",
                   "구석에서 무언가가 눈에 들어온다. 벽에 기대어 있는 낡은 아케이드 기계. 화면은 깜빡이며 지친 듯 주황빛으로 웅웅거린다. PONG.",
                   "한 걸음 다가간다. 공기가 한 도 차가워진다. 목덜미에 숨결이 닿는다. 기계가 눈을 뜨고, 첫 공이 떨어진다." ],
        'ja':    [ "ついに安全地帯にたどり着いた。背後の足音もなく、闇のささやきもない。ほんの一瞬、自分はひとりだと信じてみる。",
                   "隅に何かが目を引く。壁に寄りかかる古いアーケード筐体。画面はちらつき、疲れたような橙色でうなっている。PONG。",
                   "一歩近づく。空気が一度下がる。首筋に息が触れる。筐体が目を覚まし、最初の球が落ちる。" ],
        'zh-cn': [ "终于抵达安全区。身后没有脚步声，黑暗中也没有低语。片刻间，你允许自己相信——你是独自一人。",
                   "角落里，一样东西吸引了你的目光。一台老旧的街机，斜倚在墙边。屏幕闪烁着，散发出疲惫的暗橙光。PONG。",
                   "你又靠近一步。空气骤然下降一度。颈后落下一丝呼吸。机器眨着眼苏醒，第一颗球落了下来。" ],
        'pt-br': [ "Enfim, a área segura. Nenhum passo atrás de você, nenhum sussurro no escuro. Por um longo instante, você se permite acreditar que está sozinho.",
                   "Algo no canto chama sua atenção — uma velha cabine de arcade encostada na parede. A tela treme, zumbindo num laranja cansado. PONG.",
                   "Você se aproxima. O ar cai um grau. Uma respiração pousa na sua nuca. A cabine desperta piscando, e a primeira bola cai." ],
        'es':    [ "Por fin, la zona segura. No hay pasos detrás de ti, ni susurros en la oscuridad. Por un instante largo, te permites creer que estás solo.",
                   "Algo en el rincón te llama la atención — una vieja cabina de arcade apoyada contra la pared. La pantalla parpadea, zumbando un naranja cansado. PONG.",
                   "Das un paso más. El aire cae un grado. Un aliento toca tu nuca. La cabina despierta parpadeando, y cae la primera pelota." ],
        'fr':    [ "Enfin, la zone sûre. Aucun pas derrière toi, aucun murmure dans le noir. Un long instant, tu te laisses croire seul.",
                   "Dans un coin, quelque chose attire ton regard — une vieille borne d'arcade appuyée au mur. L'écran scintille, bourdonnant d'un orange fatigué. PONG.",
                   "Tu t'approches. L'air se refroidit d'un degré. Un souffle frôle ta nuque. La borne s'éveille en clignant, et la première balle tombe." ],
        'de':    [ "Endlich die sichere Zone. Keine Schritte hinter dir, kein Flüstern im Dunkeln. Für einen langen Moment lässt du dich glauben, du seist allein.",
                   "Etwas in der Ecke fällt dir auf — ein alter Arcade-Automat, an die Wand gelehnt. Der Schirm flackert, brummt ein müdes Orange. PONG.",
                   "Du trittst näher. Die Luft fällt um ein Grad. Ein Atem landet in deinem Nacken. Der Automat erwacht mit einem Blinzeln, und der erste Ball fällt." ],
        'ru':    [ "Наконец-то безопасная зона. Ни шагов за спиной, ни шёпота в темноте. На долгий миг ты позволяешь себе верить, что ты один.",
                   "В углу что-то привлекает твой взгляд — старый аркадный автомат, прислонённый к стене. Экран мерцает, гудит уставшим оранжевым. PONG.",
                   "Ты делаешь шаг ближе. Воздух падает на градус. Чьё-то дыхание касается твоего затылка. Автомат пробуждается, моргнув, и падает первый шар." ],
        'it':    [ "Finalmente, la zona sicura. Nessun passo alle tue spalle, nessun sussurro nel buio. Per un lungo istante, ti lasci credere di essere solo.",
                   "Qualcosa nell'angolo ti cattura lo sguardo — un vecchio cabinato arcade, appoggiato al muro. Lo schermo tremola, ronzando di un arancione stanco. PONG.",
                   "Ti avvicini. L'aria cala di un grado. Un respiro ti sfiora la nuca. Il cabinato si sveglia con un battito, e cade la prima palla." ],
        'hi':    [ "आख़िरकार, सुरक्षित क्षेत्र। पीछे न कोई क़दम, न अँधेरे में कोई फुसफुसाहट। एक लंबे पल के लिए, तुम ख़ुद को अकेला मान लेते हो।",
                   "कोने में कुछ तुम्हारी नज़र खींचता है — दीवार से टिकी एक पुरानी आर्केड मशीन। स्क्रीन झिलमिलाती है, थके हुए नारंगी रंग में गूँजती है। PONG।",
                   "तुम एक क़दम पास जाते हो। हवा एक डिग्री गिर जाती है। गर्दन पर एक साँस उतरती है। मशीन पलक झपकाते हुए जागती है, और पहली गेंद गिरती है।" ],
        'tr':    [ "Nihayet güvenli bölge. Arkanda adım sesi, karanlıkta fısıltı yok. Uzun bir an için, yalnız olduğuna inanmana izin veriyorsun.",
                   "Köşede bir şey gözüne çarpıyor — duvara yaslanmış eski bir arcade kabini. Ekran titreşiyor, yorgun bir turuncuyla uğulduyor. PONG.",
                   "Bir adım yaklaşıyorsun. Hava bir derece düşüyor. Ensene bir nefes değiyor. Kabin göz kırparak uyanıyor, ve ilk top düşüyor." ],
    };
    const ENDING_SLIDES = {
        'en':    [ "The cabinet sighs. The hum fades.",
                   "You look up. The seat across from you is empty. It always was." ],
        'ko':    [ "기계가 한숨을 쉰다. 웅웅거림이 잦아든다.",
                   "고개를 든다. 맞은편 의자는 비어 있다. 처음부터 비어 있었다." ],
        'ja':    [ "筐体がため息をつく。うなりが消えていく。",
                   "顔を上げる。向かいの椅子は空だ。ずっと空だった。" ],
        'zh-cn': [ "机器叹了口气。嗡鸣渐渐消失。",
                   "你抬起头。对面的椅子空着。它一直都是空的。" ],
        'pt-br': [ "A cabine suspira. O zumbido se desvanece.",
                   "Você ergue os olhos. A cadeira à sua frente está vazia. Sempre esteve." ],
        'es':    [ "La cabina suspira. El zumbido se apaga.",
                   "Levantas la vista. La silla enfrente está vacía. Siempre lo estuvo." ],
        'fr':    [ "La borne soupire. Le bourdonnement s'éteint.",
                   "Tu lèves les yeux. Le siège en face est vide. Il l'a toujours été." ],
        'de':    [ "Der Automat seufzt. Das Brummen verstummt.",
                   "Du blickst auf. Der Sitz dir gegenüber ist leer. Er war es immer." ],
        'ru':    [ "Автомат вздыхает. Гул угасает.",
                   "Ты поднимаешь голову. Стул напротив пуст. Он всегда был пуст." ],
        'it':    [ "Il cabinato sospira. Il ronzio si spegne.",
                   "Alzi lo sguardo. Il posto davanti a te è vuoto. Lo è sempre stato." ],
        'hi':    [ "मशीन एक साँस छोड़ती है। गूँज धीरे-धीरे मिटती है।",
                   "तुम ऊपर देखते हो। सामने की कुर्सी खाली है। वह हमेशा से खाली थी।" ],
        'tr':    [ "Kabin iç çekiyor. Uğultu sönüyor.",
                   "Başını kaldırıyorsun. Karşındaki koltuk boş. Hep boştu." ],
    };
    const INTRO_SKIP_HINT = {
        'en': 'tap or press SPACE to skip',
        'ko': '탭하거나 SPACE 키로 넘기기',
        'ja': 'タップまたはスペースでスキップ',
        'zh-cn': '点击或按空格跳过',
        'pt-br': 'toque ou pressione ESPAÇO para pular',
        'es': 'toca o pulsa ESPACIO para saltar',
        'fr': 'touche ou ESPACE pour passer',
        'de': 'tippen oder LEERTASTE zum Überspringen',
        'ru': 'коснитесь или ПРОБЕЛ, чтобы пропустить',
        'it': 'tocca o SPAZIO per saltare',
        'hi': 'टैप या SPACE दबाकर छोड़ें',
        'tr': 'geçmek için dokun veya SPACE',
    };

    function detectLang() {
        const supported = Object.keys(INTRO_SLIDES);
        const candidates = (navigator.languages && navigator.languages.length)
            ? navigator.languages : [navigator.language || 'en'];
        for (const raw of candidates) {
            if (!raw) continue;
            const lower = raw.toLowerCase();
            if (supported.includes(lower)) return lower;
            const base = lower.split('-')[0];
            if (base === 'zh') return 'zh-cn';
            if (base === 'pt') return 'pt-br';
            if (supported.includes(base)) return base;
        }
        return 'en';
    }

    // ---- State ----
    let state = 'INTRO';            // INTRO, PHASE_ANNOUNCE, PLAYING, WIN, GAME_OVER
    let score = 0;
    let combo = 0;
    let maxCombo = 0;

    let balls = [];
    let playerY, aiY;
    let paddleH = PADDLE_H_DEFAULT;
    let controlReversed = false;
    let currentPhase = 0;

    let phaseAnnounceTimer = 90;
    let phaseAnnounceName = PHASES[0].name;
    let phaseAnnounceSubtitle = PHASES[0].sub;

    let particles = [];
    let trails = [];
    let shakeAmount = 0;
    let bgPulse = 0;
    let flashAlpha = 0;

    let lastBlinkToggle = 0;
    let blinkVisible = true;

    // ---- Signature gimmicks ----
    let decoyActive = false;         // DOPPELGANGER / DECOYS / VOID
    let fakePaddleActive = false;    // MIMICRY / VOID
    let fakePaddleY = H / 2;
    let fakePaddleTargetY = H / 2;
    let fakePaddleSettleTimer = 0;

    // Track ball prev-x for midline-crossing detection
    // (only the real main ball triggers a decoy)
    let mainPrevX = W / 2;

    // ---- Intro / Ending ----
    const INTRO_SLIDE_FRAMES = 240;  // 4s per slide at 60fps
    const INTRO_FADE = 24;           // fade in / out frames
    const END_HOLD_FRAMES = 150;     // how long WIN/GAME_OVER stays before ENDING starts (~2.5s)
    let introLang = 'en';
    let introSlides = INTRO_SLIDES['en'];
    let introSkipHint = INTRO_SKIP_HINT['en'];
    let introSlideIdx = 0;
    let introSlideTimer = INTRO_SLIDE_FRAMES;

    let endingSlides = ENDING_SLIDES['en'];
    let endingSlideIdx = 0;
    let endingSlideTimer = INTRO_SLIDE_FRAMES;
    let endingHoldTimer = 0;
    let gameOutcome = null;          // 'WIN' | 'GAME_OVER'

    // ---- Input ----
    let keysDown = {};
    let usingPointer = false;
    let pointerY = H / 2;
    let lastPointerY = 0;
    let gameEnded = false;   // guards against double-dispatch of gameComplete
    // Touch uses RELATIVE dragging: remember where the finger started and where the
    // paddle was at that moment. On move, apply the delta to the paddle.
    let touchOriginY = null;
    let touchOriginPaddle = null;

    // ---- Touch preventer + control hint + resize (installed in setup, removed in cleanup) ----
    let touchPreventer = null;
    let canvasEl = null;
    let hintEl = null;
    let resizeHandler = null;

    function getPhaseForScore(s) {
        let ph = 0;
        for (let i = PHASES.length - 1; i >= 0; i--) {
            if (s >= PHASES[i].score) { ph = i; break; }
        }
        return ph;
    }

    function createBall(isMain, forceDir = 0) {
        // forceDir: 1 = serve toward AI, -1 = serve toward player, 0 = random
        const angle = p.random(-p.PI / 4, p.PI / 4);
        const dir = forceDir !== 0 ? forceDir : (p.random() > 0.5 ? 1 : -1);
        return {
            x: W / 2,
            y: H / 2,
            dx: Math.cos(angle) * BASE_BALL_SPEED * dir,
            dy: Math.sin(angle) * BASE_BALL_SPEED,
            isMain,
            alive: true,
            visible: true,
            wave: false,
            blink: false,
            speedMult: 1.0,
        };
    }

    function resetGame() {
        score = 0;
        combo = 0;
        maxCombo = 0;
        currentPhase = 0;
        paddleH = PADDLE_H_DEFAULT;
        controlReversed = false;
        playerY = (H - paddleH) / 2;
        aiY = (H - paddleH) / 2;
        balls = [createBall(true, /*forceDir=*/1)];  // first serve toward AI — grace period for controls
        particles = [];
        trails = [];
        shakeAmount = 0;
        bgPulse = 0;
        flashAlpha = 0;
        gameEnded = false;

        decoyActive = false;
        fakePaddleActive = false;
        fakePaddleY = H / 2 - paddleH / 2;
        fakePaddleTargetY = fakePaddleY;
        fakePaddleSettleTimer = 0;
        mainPrevX = W / 2;

        introLang = detectLang();
        introSlides = INTRO_SLIDES[introLang] || INTRO_SLIDES['en'];
        introSkipHint = INTRO_SKIP_HINT[introLang] || INTRO_SKIP_HINT['en'];
        introSlideIdx = 0;
        introSlideTimer = INTRO_SLIDE_FRAMES;

        endingSlides = ENDING_SLIDES[introLang] || ENDING_SLIDES['en'];
        endingSlideIdx = 0;
        endingSlideTimer = INTRO_SLIDE_FRAMES;
        endingHoldTimer = 0;
        gameOutcome = null;

        state = 'INTRO';
        phaseAnnounceName = PHASES[0].name;
        phaseAnnounceSubtitle = PHASES[0].sub;
        phaseAnnounceTimer = 90;
    }

    function advanceIntro() {
        if (introSlideIdx < introSlides.length - 1) {
            introSlideIdx++;
            introSlideTimer = INTRO_SLIDE_FRAMES;
        } else {
            state = 'PHASE_ANNOUNCE';
            flashAlpha = 120;
            shakeAmount = 6;
        }
    }

    function beginEnding() {
        endingSlideIdx = 0;
        endingSlideTimer = INTRO_SLIDE_FRAMES;
        state = 'ENDING';
    }

    function advanceEnding() {
        if (endingSlideIdx < endingSlides.length - 1) {
            endingSlideIdx++;
            endingSlideTimer = INTRO_SLIDE_FRAMES;
        } else {
            // Last slide done — dispatch the redeem-code event. The outer shell
            // will then replace the canvas with the win-screen UI.
            const finalScore = gameOutcome === 'WIN' ? MAX_SCORE : score;
            finishGame(finalScore);
        }
    }

    // ============================================================
    //  Setup
    // ============================================================

    p.setup = function() {
        const container = document.getElementById('game-canvas-container');
        const canvas = p.createCanvas(W, H);
        canvasEl = canvas.elt;
        // Compute explicit pixel sizes from the viewport so mobile browsers without
        // aspect-ratio CSS still get the correct 16:9 shape.
        function sizeCanvas() {
            const vw = Math.min(window.innerWidth * 0.88, 960);
            const vh = vw * 9 / 16;
            canvasEl.style.width = `${vw}px`;
            canvasEl.style.height = `${vh}px`;
            canvasEl.style.flex = '0 0 auto';         // defeat flex-stretch
        }

        // The container just flipped from display:none → flex. Layout may not be
        // settled on the first frame, so run sizeCanvas multiple times: now, next
        // paint, and a couple safety retries. Also observe the window for any
        // subsequent resizes (orientation change, devtools toggle, etc.).
        sizeCanvas();
        requestAnimationFrame(sizeCanvas);
        setTimeout(sizeCanvas,  60);
        setTimeout(sizeCanvas, 250);
        setTimeout(sizeCanvas, 800);

        resizeHandler = () => sizeCanvas();
        window.addEventListener('resize', resizeHandler);
        window.addEventListener('orientationchange', resizeHandler);

        // ResizeObserver catches container/CSS changes that don't fire window resize.
        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => sizeCanvas());
            ro.observe(document.documentElement);
            // Store so cleanup can disconnect
            canvasEl._mimesisPongRO = ro;
        }

        canvasEl.style.touchAction = 'none';
        p.textFont('monospace');
        p.pixelDensity(1);

        // Hint element under the canvas.
        hintEl = document.createElement('div');
        hintEl.id = 'mimesis-pong-hint';
        hintEl.textContent = '📱 Slide your finger up or down to move your paddle.  ⌨️ Arrow keys / W·S / mouse also work.';
        hintEl.style.cssText = [
            'position: absolute',
            'bottom: 12px',
            'left: 50%',
            'transform: translateX(-50%)',
            'max-width: 92vw',
            'text-align: center',
            'color: rgba(205, 214, 244, 0.78)',
            'font-size: 12px',
            'line-height: 1.45',
            'font-family: Inter, "Segoe UI", system-ui, sans-serif',
            'padding: 6px 10px',
            'background: rgba(18, 20, 40, 0.55)',
            'border-radius: 6px',
            'backdrop-filter: blur(4px)',
            'pointer-events: none',
            'z-index: 3',
        ].join(';');
        (container || document.body).appendChild(hintEl);

        // Prevent page scroll on touch over canvas
        touchPreventer = (e) => {
            if (e.target === canvasEl) e.preventDefault();
        };
        document.addEventListener('touchmove', touchPreventer, { passive: false });
        document.addEventListener('touchstart', touchPreventer, { passive: false });

        resetGame();
    };

    // ============================================================
    //  Main loop
    // ============================================================

    p.draw = function() {
        let sx = 0, sy = 0;
        if (shakeAmount > 0.5) {
            sx = p.random(-shakeAmount, shakeAmount);
            sy = p.random(-shakeAmount, shakeAmount);
            shakeAmount *= 0.9;
        } else {
            shakeAmount = 0;
        }

        p.push();
        p.translate(sx, sy);

        drawBackground();

        switch (state) {
            case 'INTRO':          updateIntro(); drawIntro(); break;
            case 'PLAYING':        updateGame(); drawGame(); break;
            case 'PHASE_ANNOUNCE': updatePhaseAnnounce(); drawGame(); drawPhaseAnnounce(); break;
            case 'WIN':            drawGame(); drawWin(); updateEndingHold(); break;
            case 'GAME_OVER':      drawGame(); drawGameOver(); updateEndingHold(); break;
            case 'ENDING':         updateEnding(); drawEnding(); break;
        }

        drawScanlines();
        drawVignette();
        drawFlash();

        p.pop();
    };

    function drawBackground() {
        p.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);

        p.stroke(PALETTE.grid[0], PALETTE.grid[1], PALETTE.grid[2], 40);
        p.strokeWeight(0.5);
        for (let x = 0; x < W; x += 40) p.line(x, 0, x, H);
        for (let y = 0; y < H; y += 40) p.line(0, y, W, y);

        p.stroke(255, 255, 255, 25);
        p.strokeWeight(2);
        for (let y = 0; y < H; y += 20) {
            if (y % 40 < 20) p.line(W / 2, y, W / 2, y + 10);
        }

        if (bgPulse > 0) {
            p.noStroke();
            p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], bgPulse * 15);
            p.rect(0, 0, W, H);
            bgPulse *= 0.92;
            if (bgPulse < 0.3) bgPulse = 0;
        }
    }

    // ============================================================
    //  Intro
    // ============================================================

    function updateIntro() {
        introSlideTimer--;
        if (introSlideTimer <= 0) advanceIntro();
    }

    function updateEndingHold() {
        if (endingHoldTimer > 0) {
            endingHoldTimer--;
            if (endingHoldTimer === 0) beginEnding();
        }
    }

    function updateEnding() {
        endingSlideTimer--;
        if (endingSlideTimer <= 0) advanceEnding();
    }

    function drawEnding() {
        // Slightly darker than the intro — the cabinet has fallen silent.
        p.noStroke();
        p.fill(0, 0, 0, 210);
        p.rect(0, 0, W, H);

        // Whispery dust motes
        if (p.frameCount % 4 === 0 && particles.length < 40) {
            spawnParticles(p.random(W * 0.1, W * 0.9), p.random(H * 0.3, H * 0.7), 1, [180, 180, 210]);
        }
        updateParticles();
        for (const pt of particles) {
            p.fill(pt.color[0], pt.color[1], pt.color[2], Math.min(pt.alpha, 100));
            p.noStroke();
            p.ellipse(pt.x, pt.y, pt.size * 0.8);
        }

        // Slide alpha (fade in, hold, fade out)
        const t = INTRO_SLIDE_FRAMES - endingSlideTimer;
        let alpha;
        if (t < INTRO_FADE)                            alpha = p.map(t, 0, INTRO_FADE, 0, 255);
        else if (endingSlideTimer < INTRO_FADE)        alpha = p.map(endingSlideTimer, 0, INTRO_FADE, 0, 255);
        else                                           alpha = 255;

        p.textAlign(p.CENTER, p.CENTER);
        p.textStyle(p.NORMAL);

        // Two-dot slide indicator
        const dotY = H * 0.25;
        for (let i = 0; i < endingSlides.length; i++) {
            const active = i === endingSlideIdx;
            p.noStroke();
            p.fill(220, 220, 240, active ? 200 : 60);
            p.ellipse(W / 2 + (i - 0.5) * 18, dotY, active ? 6 : 4);
        }

        // Main slide text
        p.drawingContext.shadowBlur = 22;
        p.drawingContext.shadowColor = `rgba(200, 200, 230, ${alpha / 420})`;
        p.fill(215, 220, 240, alpha);
        p.textSize(22);
        p.text(endingSlides[endingSlideIdx], W * 0.08, H * 0.38, W * 0.84, H * 0.3);
        p.drawingContext.shadowBlur = 0;

        // Skip hint
        const hintPulse = 90 + Math.sin(p.frameCount * 0.08) * 40;
        p.fill(255, 255, 255, hintPulse);
        p.textSize(11);
        p.text(introSkipHint, W / 2, H * 0.9);
    }

    function drawIntro() {
        // Dimmed overlay
        p.noStroke();
        p.fill(0, 0, 0, 180);
        p.rect(0, 0, W, H);

        // Eyes watching from the dark (subtle)
        const eyePulse = 60 + Math.sin(p.frameCount * 0.05) * 18;
        p.fill(PALETTE.ai[0], PALETTE.ai[1], PALETTE.ai[2], eyePulse);
        p.noStroke();
        p.ellipse(W * 0.32, H * 0.18, 6, 6);
        p.ellipse(W * 0.36, H * 0.18, 6, 6);
        p.ellipse(W * 0.68, H * 0.82, 5, 5);
        p.ellipse(W * 0.72, H * 0.82, 5, 5);

        // Compute slide alpha (fade in, hold, fade out)
        const t = INTRO_SLIDE_FRAMES - introSlideTimer; // 0..INTRO_SLIDE_FRAMES
        let alpha;
        if (t < INTRO_FADE)                              alpha = p.map(t, 0, INTRO_FADE, 0, 255);
        else if (introSlideTimer < INTRO_FADE)           alpha = p.map(introSlideTimer, 0, INTRO_FADE, 0, 255);
        else                                             alpha = 255;

        p.textAlign(p.CENTER, p.CENTER);
        p.textStyle(p.NORMAL);

        // Slide index indicator (three dots)
        const dotY = H * 0.25;
        for (let i = 0; i < introSlides.length; i++) {
            const active = i === introSlideIdx;
            p.noStroke();
            p.fill(255, 255, 255, active ? 200 : 70);
            p.ellipse(W / 2 + (i - 1) * 16, dotY, active ? 6 : 4);
        }

        // Main slide text with glow
        p.drawingContext.shadowBlur = 22;
        p.drawingContext.shadowColor = `rgba(${PALETTE.accent[0]}, ${PALETTE.accent[1]}, ${PALETTE.accent[2]}, ${alpha / 340})`;
        p.fill(235, 238, 255, alpha);
        p.textSize(22);
        // Wrap manually — p5 text() wraps if you give it a width box, but we want control
        p.text(introSlides[introSlideIdx], W * 0.08, H * 0.38, W * 0.84, H * 0.3);
        p.drawingContext.shadowBlur = 0;

        // Skip hint
        const hintPulse = 100 + Math.sin(p.frameCount * 0.08) * 40;
        p.fill(255, 255, 255, hintPulse);
        p.textSize(11);
        p.text(introSkipHint, W / 2, H * 0.9);
    }

    // ============================================================
    //  Game logic
    // ============================================================

    function updateGame() {
        // Touch takes priority — it drives playerY directly via p.touchMoved.
        // Skip both mouse-pointer and keyboard logic while a finger is down.
        const touchActive = touchOriginY !== null;

        if (!touchActive) {
            // Input resolution (keyboard / mouse)
            if (keysDown[38] || keysDown[87] || keysDown[40] || keysDown[83]) {
                usingPointer = false;
            } else if (Math.abs(pointerY - lastPointerY) > 2) {
                usingPointer = true;
                lastPointerY = pointerY;
            }

            if (usingPointer) {
                let target = pointerY - paddleH / 2;
                if (controlReversed) {
                    const center = H / 2;
                    target = 2 * center - target - paddleH;
                }
                target = p.constrain(target, 0, H - paddleH);
                playerY = p.lerp(playerY, target, 0.28);
            } else {
                let moveDir = 0;
                if (keysDown[38] || keysDown[87]) moveDir = -1;
                if (keysDown[40] || keysDown[83]) moveDir = 1;
                if (moveDir !== 0) {
                    const actualDir = controlReversed ? -moveDir : moveDir;
                    playerY += actualDir * PLAYER_PADDLE_SPEED;
                }
            }
        }
        playerY = p.constrain(playerY, 0, H - paddleH);

        // Phase advance
        const newPhase = getPhaseForScore(score);
        if (newPhase !== currentPhase && newPhase < PHASES.length) {
            currentPhase = newPhase;
            applyPhase(PHASES[currentPhase]);

            if (currentPhase === PHASES.length - 1) {
                state = 'WIN';
                gameOutcome = 'WIN';
                endingHoldTimer = END_HOLD_FRAMES;
                shakeAmount = 20;
                flashAlpha = 200;
                return;
            }

            phaseAnnounceName = PHASES[currentPhase].name;
            phaseAnnounceSubtitle = PHASES[currentPhase].sub;
            phaseAnnounceTimer = 120;
            state = 'PHASE_ANNOUNCE';
            flashAlpha = 80;
            shakeAmount = 8;
            return;
        }

        // Blink timing
        const blinkInterval = 18;
        if (p.frameCount % blinkInterval === 0) blinkVisible = !blinkVisible;

        // Update balls
        for (const ball of balls) {
            if (!ball.alive) continue;

            let waveOffset = 0;
            if (ball.wave) waveOffset = Math.sin(ball.x * 0.03) * 6;

            const prevX = ball.x;
            ball.x += ball.dx * ball.speedMult;
            ball.y += ball.dy * ball.speedMult;

            let effectiveY = ball.y + waveOffset;
            effectiveY = p.constrain(effectiveY, BALL_R, H - BALL_R);

            if (effectiveY - BALL_R <= 0 || effectiveY + BALL_R >= H) {
                ball.dy *= -1;
                if (!ball.isDecoy) spawnParticles(ball.x, effectiveY, 5, [200, 200, 255]);
            }

            ball.visible = ball.blink ? blinkVisible : true;

            // Decoys pass through paddles and don't score. They just travel.
            if (!ball.isDecoy) {
                // Player paddle collision
                if (ball.dx < 0 &&
                    ball.x - BALL_R <= PADDLE_MARGIN + PADDLE_W + 4 &&
                    ball.x - BALL_R >= PADDLE_MARGIN - 10 &&
                    effectiveY >= playerY && effectiveY <= playerY + paddleH) {
                    ball.dx = Math.abs(ball.dx);
                    const hitPos = (effectiveY - playerY) / paddleH;
                    const angle = p.map(hitPos, 0, 1, -p.PI / 3.5, p.PI / 3.5);
                    const spd = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                    ball.dx = Math.cos(angle) * spd;
                    ball.dy = Math.sin(angle) * spd;
                    ball.x = PADDLE_MARGIN + PADDLE_W + BALL_R + 5;

                    if (ball.isMain) {
                        score++;
                        combo++;
                        maxCombo = Math.max(maxCombo, combo);
                    }
                    onPaddleHit(ball, 'player');
                }

                // AI paddle collision (forgiving: +20px vertical tolerance on each side
                // so a tad-bit-late AI still bounces the ball back)
                const AI_TOLERANCE = 20;
                if (ball.dx > 0 &&
                    ball.x + BALL_R >= W - PADDLE_MARGIN - PADDLE_W - 4 &&
                    ball.x + BALL_R <= W - PADDLE_MARGIN + 10 &&
                    effectiveY >= aiY - AI_TOLERANCE &&
                    effectiveY <= aiY + paddleH + AI_TOLERANCE) {
                    ball.dx = -Math.abs(ball.dx);
                    ball.x = W - PADDLE_MARGIN - PADDLE_W - BALL_R - 5;

                    if (ball.isMain) {
                        score++;
                        combo++;
                        maxCombo = Math.max(maxCombo, combo);
                    }
                    onPaddleHit(ball, 'ai');

                    // Doppelganger volley — spawn at the AI paddle as the Mimesis
                    // "replicates" on contact with the real ball.
                    if (decoyActive && ball.isMain) {
                        const liveDecoys = balls.filter(b => b.alive && b.isDecoy).length;
                        if (liveDecoys === 0) {
                            const palette = decoyPaletteForPhase();
                            const spawnX = W - PADDLE_MARGIN - PADDLE_W - BALL_R - 5;
                            for (const color of palette) {
                                spawnDecoyBall(spawnX, effectiveY, color);
                            }
                        }
                    }
                }
            }

            // Out of bounds
            if (ball.x < -BALL_R * 2 || ball.x > W + BALL_R * 2) {
                ball.alive = false;
                if (!ball.isDecoy) {
                    combo = 0;
                    spawnParticles(ball.x < 0 ? 0 : W, effectiveY, 20, PALETTE.reversed);
                    shakeAmount = 12;

                    if (ball.isMain) {
                        ball.isMain = false;
                        const alive = balls.filter(b => b.alive && !b.isDecoy);
                        if (alive.length > 0) alive[0].isMain = true;
                    }
                }
            }

            ball.y = effectiveY;

            if (ball.alive && ball.visible) {
                const trailColor = ball.isDecoy ? (ball.decoyColor || PALETTE.ai)
                                 : ball.isMain  ? PALETTE.trail
                                 :               PALETTE.ai;
                trails.push({
                    x: ball.x, y: ball.y,
                    r: BALL_R * 0.8,
                    alpha: ball.isDecoy ? 90 : 180,
                    color: trailColor,
                });
            }
        }

        // Update fake paddle motion
        updateFakePaddle();

        // AI paddle movement
        let mainBall = balls.find(b => b.isMain && b.alive);
        if (!mainBall) mainBall = balls.find(b => b.alive);
        if (mainBall) {
            const aiSpeed = p.map(currentPhase, 0, PHASES.length - 1, 3.3, 5.4);
            let aiTarget = mainBall.y - paddleH / 2;
            aiTarget += Math.sin(p.frameCount * 0.02) * 20;

            if (mainBall.dx > 0) {
                if (Math.abs(aiY - aiTarget) > 3) {
                    aiY += (aiTarget - aiY) > 0 ? aiSpeed : -aiSpeed;
                }
            } else {
                const center = H / 2 - paddleH / 2;
                aiY = p.lerp(aiY, center, 0.02);
            }
        }
        aiY = p.constrain(aiY, 0, H - paddleH);

        // Game over only when all NON-decoy balls are dead.
        const realBalls = balls.filter(b => !b.isDecoy);
        if (realBalls.length > 0 && realBalls.every(b => !b.alive)) {
            state = 'GAME_OVER';
            gameOutcome = 'GAME_OVER';
            endingHoldTimer = END_HOLD_FRAMES;
            shakeAmount = 15;
        }
        // Purge dead decoys to keep the array bounded
        balls = balls.filter(b => !(b.isDecoy && !b.alive));

        updateParticles();
        updateTrails();
    }

    function applyPhase(phase) {
        controlReversed = phase.reverse;
        paddleH = phase.paddleH;
        playerY = p.constrain(playerY, 0, H - paddleH);
        aiY = p.constrain(aiY, 0, H - paddleH);
        decoyActive = !!phase.decoyBall;
        fakePaddleActive = !!phase.fakePaddle;
        if (fakePaddleActive) {
            fakePaddleY = p.random(0, H - paddleH);
            fakePaddleTargetY = p.random(0, H - paddleH);
            fakePaddleSettleTimer = 0;
        }

        for (const ball of balls) {
            if (!ball.alive) continue;
            if (ball.isDecoy) continue; // real balls only inherit phase mechanics
            ball.wave = phase.wave;
            ball.blink = phase.blink;
            ball.speedMult = phase.speedMult;
        }

        if (phase.multiBall && balls.filter(b => b.alive && !b.isDecoy).length < 2) {
            const aliveBall = balls.find(b => b.alive && !b.isDecoy);
            const newBall = createBall(false);
            newBall.wave = phase.wave;
            newBall.blink = phase.blink;
            newBall.speedMult = phase.speedMult;
            if (aliveBall) {
                newBall.dx = -aliveBall.dx;
                newBall.dy = -aliveBall.dy;
            }
            balls.push(newBall);
        }
    }

    function spawnDecoyBall(x, y, color) {
        // Decoy always heads toward the player (left side) at a random-ish angle.
        const angle = p.random(-p.PI / 3, p.PI / 3);
        const spd = BASE_BALL_SPEED * (0.95 + p.random(-0.08, 0.15));
        balls.push({
            x, y,
            dx: -Math.cos(angle) * spd,     // negative → toward player
            dy: Math.sin(angle) * spd,
            isMain: false,
            isDecoy: true,
            decoyColor: color || [255, 90, 100],
            alive: true,
            visible: true,
            wave: false,
            blink: false,
            speedMult: 1.0,
        });
    }

    // Pick the decoy color palette for the current phase:
    //   phase 1 (DOPPELGANGER) → 3 balls (R / G / B)
    //   later decoy phases     → 5 balls (R / G / B / Y / P)
    function decoyPaletteForPhase() {
        return currentPhase <= 1 ? DECOY_PALETTE_3 : DECOY_PALETTE_5;
    }

    function onPaddleHit(ball, side) {
        shakeAmount = 3 + combo * 0.5;
        bgPulse = Math.min(combo, 8);
        spawnParticles(
            side === 'player' ? PADDLE_MARGIN + PADDLE_W : W - PADDLE_MARGIN - PADDLE_W,
            ball.y, 8 + combo * 2,
            side === 'player' ? PALETTE.player : PALETTE.ai
        );
    }

    function updateFakePaddle() {
        if (!fakePaddleActive) return;
        fakePaddleSettleTimer--;
        if (fakePaddleSettleTimer <= 0) {
            // Pick a new target somewhere on the player side. Occasionally mimic the real paddle.
            if (p.random() < 0.25) {
                fakePaddleTargetY = playerY + p.random(-20, 20);
            } else {
                fakePaddleTargetY = p.random(0, H - paddleH);
            }
            fakePaddleSettleTimer = Math.floor(p.random(20, 55));
        }
        fakePaddleY = p.lerp(fakePaddleY, fakePaddleTargetY, 0.08);
        fakePaddleY = p.constrain(fakePaddleY, 0, H - paddleH);
    }

    function drawFakePaddle() {
        if (!fakePaddleActive) return;
        // Grey, slightly transparent; drawn BEFORE the real paddle so the player's paddle
        // always appears on top if they overlap.
        p.noStroke();
        p.drawingContext.shadowBlur = 8;
        p.drawingContext.shadowColor = 'rgba(160, 160, 180, 0.4)';
        p.fill(150, 150, 170, 150);
        p.rect(PADDLE_MARGIN, fakePaddleY, PADDLE_W, paddleH, 4);
        p.drawingContext.shadowBlur = 0;
        // Subtle dashed edge so it reads as "not real"
        p.stroke(200, 200, 220, 90);
        p.strokeWeight(1);
        p.noFill();
        p.rect(PADDLE_MARGIN, fakePaddleY, PADDLE_W, paddleH, 4);
        p.noStroke();
    }

    // Dispatch the gameComplete event exactly once. Score is clamped to [0, MAX_SCORE].
    function finishGame(finalScore) {
        if (gameEnded) return;
        gameEnded = true;
        const clamped = Math.max(0, Math.min(MAX_SCORE, Math.round(finalScore)));
        const salt = sessionStorage.getItem('currentGameSalt');
        window.dispatchEvent(new CustomEvent('gameComplete', {
            detail: { gameId: 'mimesis_pong', score: clamped, salt }
        }));

        setTimeout(() => {
            p.noLoop();
            if (typeof window.cleanupPreviousGame === 'function') {
                window.cleanupPreviousGame();
            }
        }, 2500);
    }

    // ============================================================
    //  Phase announce + HUD
    // ============================================================

    function updatePhaseAnnounce() {
        phaseAnnounceTimer--;
        if (phaseAnnounceTimer <= 0) state = 'PLAYING';
        updateGame();
    }

    function drawPhaseAnnounce() {
        const progress = phaseAnnounceTimer / 120;
        let alpha = progress < 0.2 ? p.map(progress, 0, 0.2, 0, 255) : 255;
        alpha = progress > 0.8 ? p.map(progress, 0.8, 1, 255, 0) : alpha;

        p.noStroke();
        p.fill(0, 0, 0, alpha * 0.45);
        p.rect(0, 0, W, H);

        p.drawingContext.shadowBlur = 30;
        p.drawingContext.shadowColor = `rgba(${PALETTE.accent[0]}, ${PALETTE.accent[1]}, ${PALETTE.accent[2]}, ${alpha / 255})`;
        p.fill(255, 255, 255, alpha);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(48);
        p.textStyle(p.BOLD);
        p.text(phaseAnnounceName, W / 2, H / 2 - 15);
        p.drawingContext.shadowBlur = 0;

        p.fill(200, 200, 220, alpha * 0.85);
        p.textSize(16);
        p.textStyle(p.ITALIC);
        p.text(phaseAnnounceSubtitle, W / 2, H / 2 + 30);
        p.textStyle(p.NORMAL);
    }

    function drawGame() {
        p.noStroke();
        for (const t of trails) {
            p.fill(t.color[0], t.color[1], t.color[2], t.alpha);
            p.ellipse(t.x, t.y, t.r * 2);
        }

        for (const pt of particles) {
            p.fill(pt.color[0], pt.color[1], pt.color[2], pt.alpha);
            p.ellipse(pt.x, pt.y, pt.size);
        }

        for (const ball of balls) {
            if (!ball.alive || !ball.visible) continue;
            p.drawingContext.shadowBlur = 15;
            // Decoy: its assigned color. Main real ball: white. Multi-ball secondary: red.
            const gc = ball.isDecoy ? (ball.decoyColor || [255, 90, 100])
                     : ball.isMain  ? PALETTE.ball
                     :                PALETTE.ai;
            p.drawingContext.shadowColor = `rgba(${gc[0]}, ${gc[1]}, ${gc[2]}, 0.8)`;
            p.fill(gc[0], gc[1], gc[2]);
            p.noStroke();
            p.ellipse(ball.x, ball.y, BALL_R * 2);
            p.drawingContext.shadowBlur = 0;
        }

        // Fake (grey) paddle BEFORE the real one so the real paddle renders on top when they overlap.
        drawFakePaddle();

        const pColor = controlReversed ? PALETTE.reversed : PALETTE.player;
        p.drawingContext.shadowBlur = 12;
        p.drawingContext.shadowColor = `rgba(${pColor[0]}, ${pColor[1]}, ${pColor[2]}, 0.6)`;
        p.noStroke();
        p.fill(pColor[0], pColor[1], pColor[2]);
        p.rect(PADDLE_MARGIN, playerY, PADDLE_W, paddleH, 4);
        p.drawingContext.shadowBlur = 0;
        p.fill(255, 255, 255, 60);
        p.rect(PADDLE_MARGIN, playerY, 2, paddleH, 2);

        p.drawingContext.shadowBlur = 12;
        p.drawingContext.shadowColor = `rgba(${PALETTE.ai[0]}, ${PALETTE.ai[1]}, ${PALETTE.ai[2]}, 0.6)`;
        p.fill(PALETTE.ai[0], PALETTE.ai[1], PALETTE.ai[2]);
        p.rect(W - PADDLE_MARGIN - PADDLE_W, aiY, PADDLE_W, paddleH, 4);
        p.drawingContext.shadowBlur = 0;
        p.fill(255, 255, 255, 60);
        p.rect(W - PADDLE_MARGIN - 2, aiY, 2, paddleH, 2);

        drawHUD();
        drawArgMarker();
    }

    // Unlocks post-phase-5 (MIMICRY). Part of the ARG — intentionally subtle
    // but not invisible. Dimmed monochrome text, slow flicker, bottom-left.
    function drawArgMarker() {
        if (currentPhase < 5) return;
        // Flicker every ~2s for a few frames; baseline sits near the combo's readability.
        const f = p.frameCount % 140;
        let alpha = 160;
        if (f < 5)           alpha = 120;
        else if (f === 60)   alpha = 210;
        p.noStroke();
        p.fill(180, 200, 225, alpha);
        p.textFont('monospace');
        p.textAlign(p.LEFT, p.BOTTOM);
        p.textSize(11);
        p.textStyle(p.NORMAL);
        p.text('subject = 33.811644.-84.375376', 10, H - 6);
    }

    function drawHUD() {
        p.textAlign(p.CENTER, p.TOP);
        p.noStroke();
        p.drawingContext.shadowBlur = 10;
        p.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.3)';
        p.fill(255, 255, 255, 210);
        p.textSize(34);
        p.textStyle(p.BOLD);
        p.text(`${score} / ${MAX_SCORE}`, W / 2, 14);
        p.drawingContext.shadowBlur = 0;

        if (PHASES[currentPhase]) {
            p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 160);
            p.textSize(11);
            p.textStyle(p.NORMAL);
            p.text(PHASES[currentPhase].name, W / 2, 56);
        }

        if (combo > 1) {
            const comboAlpha = Math.min(255, 150 + combo * 15);
            p.fill(PALETTE.player[0], PALETTE.player[1], PALETTE.player[2], comboAlpha);
            p.textSize(14);
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.TOP);
            p.text(`${combo}x COMBO`, 24, H - 32);
            p.textStyle(p.NORMAL);
        }

        if (controlReversed) {
            const blink = Math.sin(p.frameCount * 0.15) > 0;
            if (blink) {
                p.fill(PALETTE.reversed[0], PALETTE.reversed[1], PALETTE.reversed[2], 200);
                p.textAlign(p.CENTER, p.BOTTOM);
                p.textSize(12);
                p.textStyle(p.BOLD);
                p.text('INPUT MIRRORED', W / 2, H - 10);
                p.textStyle(p.NORMAL);
            }
        }

        // Progress bar toward next phase
        const nextPhaseIdx = Math.min(currentPhase + 1, PHASES.length - 1);
        const prevScore = PHASES[currentPhase].score;
        const nextScore = PHASES[nextPhaseIdx].score;
        let progress = nextScore > prevScore ? (score - prevScore) / (nextScore - prevScore) : 1;
        progress = p.constrain(progress, 0, 1);

        p.noStroke();
        p.fill(30, 28, 55, 180);
        p.rect(W / 2 - 70, 72, 140, 3, 2);
        p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 200);
        p.rect(W / 2 - 70, 72, 140 * progress, 3, 2);
    }

    // ============================================================
    //  Particles, scanlines, vignette, flash
    // ============================================================

    function spawnParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = p.random(p.TWO_PI);
            const speed = p.random(1, 5);
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: p.random(2, 6),
                alpha: 255,
                color: [...color],
                decay: p.random(3, 8),
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.vx *= 0.97;
            pt.vy *= 0.97;
            pt.alpha -= pt.decay;
            pt.size *= 0.98;
            if (pt.alpha <= 0) particles.splice(i, 1);
        }
        if (particles.length > 300) particles.splice(0, particles.length - 300);
    }

    function updateTrails() {
        for (let i = trails.length - 1; i >= 0; i--) {
            trails[i].alpha -= 12;
            trails[i].r *= 0.95;
            if (trails[i].alpha <= 0) trails.splice(i, 1);
        }
        if (trails.length > 200) trails.splice(0, trails.length - 200);
    }

    function drawScanlines() {
        p.noStroke();
        p.fill(0, 0, 0, 18);
        for (let y = 0; y < H; y += 3) {
            p.rect(0, y, W, 1);
        }
    }

    function drawVignette() {
        p.noStroke();
        const steps = 30;
        for (let i = 0; i < steps; i++) {
            const margin = p.map(i, 0, steps, W * 0.4, 0);
            p.fill(0, 0, 0, 100 / steps * 3);
            p.rect(0, 0, margin, H);
            p.rect(W - margin, 0, margin, H);
            p.rect(0, 0, W, margin * H / W);
            p.rect(0, H - margin * H / W, W, margin * H / W);
        }
    }

    function drawFlash() {
        if (flashAlpha > 0) {
            p.noStroke();
            p.fill(255, 255, 255, flashAlpha);
            p.rect(0, 0, W, H);
            flashAlpha *= 0.85;
            if (flashAlpha < 1) flashAlpha = 0;
        }
    }

    // ============================================================
    //  End screens
    // ============================================================

    function drawWin() {
        p.noStroke();
        p.fill(0, 0, 0, 150);
        p.rect(0, 0, W, H);

        p.drawingContext.shadowBlur = 50;
        p.drawingContext.shadowColor = `rgba(${PALETTE.accent[0]}, ${PALETTE.accent[1]}, ${PALETTE.accent[2]}, 0.85)`;
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(54);
        p.textStyle(p.BOLD);
        p.text('SURVIVOR', W / 2, H / 3);
        p.drawingContext.shadowBlur = 0;

        p.fill(200);
        p.textSize(18);
        p.textStyle(p.NORMAL);
        p.text('You outlasted the Mimesis.', W / 2, H / 3 + 50);

        p.fill(PALETTE.player[0], PALETTE.player[1], PALETTE.player[2]);
        p.textSize(22);
        p.text(`Score: ${score} / ${MAX_SCORE}`, W / 2, H * 0.55);

        p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2]);
        p.textSize(16);
        p.text(`Max Combo: ${maxCombo}x`, W / 2, H * 0.63);

        if (p.frameCount % 3 === 0) {
            spawnParticles(p.random(W), p.random(H), 2, [
                p.random(100, 255), p.random(60, 200), 255
            ]);
        }
        updateParticles();
        p.noStroke();
        for (const pt of particles) {
            p.fill(pt.color[0], pt.color[1], pt.color[2], pt.alpha);
            p.ellipse(pt.x, pt.y, pt.size);
        }
    }

    function drawGameOver() {
        p.noStroke();
        p.fill(0, 0, 0, 160);
        p.rect(0, 0, W, H);

        p.drawingContext.shadowBlur = 30;
        p.drawingContext.shadowColor = 'rgba(255, 40, 40, 0.6)';
        p.fill(255, 80, 100);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(46);
        p.textStyle(p.BOLD);
        p.text('THE MIMESIS WINS', W / 2, H / 3);
        p.drawingContext.shadowBlur = 0;

        p.fill(210);
        p.textSize(18);
        p.textStyle(p.NORMAL);
        p.text(`Score: ${score} / ${MAX_SCORE}`, W / 2, H / 2);

        if (maxCombo > 1) {
            p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2]);
            p.textSize(14);
            p.text(`Max Combo: ${maxCombo}x`, W / 2, H / 2 + 30);
        }
    }

    // ============================================================
    //  Input hooks (p5 instance)
    // ============================================================

    p.keyPressed = function() {
        keysDown[p.keyCode] = true;
        if (state === 'INTRO' && (p.keyCode === 32 || p.keyCode === 13)) {
            advanceIntro();
            return false;
        }
        if (state === 'ENDING' && (p.keyCode === 32 || p.keyCode === 13)) {
            advanceEnding();
            return false;
        }
        // Swallow arrow keys to stop page scroll
        if ([32, 37, 38, 39, 40].includes(p.keyCode)) {
            return false;
        }
        return true;
    };

    p.keyReleased = function() {
        keysDown[p.keyCode] = false;
        return true;
    };

    p.mouseMoved = function() {
        if (state === 'INTRO') return;
        pointerY = p.mouseY;
    };

    p.mouseDragged = function() {
        if (state === 'INTRO') return;
        pointerY = p.mouseY;
    };

    p.mousePressed = function() {
        if (state === 'INTRO') { advanceIntro(); return false; }
        if (state === 'ENDING') { advanceEnding(); return false; }
        return true;
    };

    // Floating-thumbstick touch control: first tap = origin, subsequent drag = delta.
    // Lifting the finger clears the origin; the next tap anywhere re-anchors.
    p.touchStarted = function() {
        if (state === 'INTRO') { advanceIntro(); return false; }
        if (state === 'ENDING') { advanceEnding(); return false; }
        if (p.touches.length > 0) {
            touchOriginY = p.touches[0].y;
            touchOriginPaddle = playerY;
        }
        return false;
    };

    p.touchMoved = function() {
        if (state === 'INTRO' || state === 'ENDING') return false;
        if (p.touches.length > 0 && touchOriginY !== null) {
            const dy = p.touches[0].y - touchOriginY;
            const signed = controlReversed ? -dy : dy;
            playerY = p.constrain(touchOriginPaddle + signed, 0, H - paddleH);
        }
        return false;
    };

    p.touchEnded = function() {
        touchOriginY = null;
        touchOriginPaddle = null;
        return false;
    };

    // ============================================================
    //  Cleanup (called by cleanupPreviousGame on win)
    // ============================================================

    // p5 built-in resize hook — covers anything our external listener might miss
    p.windowResized = function() {
        if (resizeHandler) resizeHandler();
    };

    p.cleanup = function() {
        p.noLoop();
        if (touchPreventer) {
            document.removeEventListener('touchmove', touchPreventer);
            document.removeEventListener('touchstart', touchPreventer);
            touchPreventer = null;
        }
        if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
            window.removeEventListener('orientationchange', resizeHandler);
            resizeHandler = null;
        }
        if (canvasEl && canvasEl._mimesisPongRO) {
            try { canvasEl._mimesisPongRO.disconnect(); } catch (e) {}
            canvasEl._mimesisPongRO = null;
        }
        if (hintEl && hintEl.parentNode) {
            hintEl.parentNode.removeChild(hintEl);
            hintEl = null;
        }
    };
};
