
/* ============================================
   CUSTOMIZATION AND ADJUSTMENT — JAVASCRIPT
   Modify the values below to customize
   images, positions, sizes, and gameplay.
   ============================================ */

const CONFIG = {
    // A. IMAGE ASSETS: Optional transparent PNGs.
    assets: {
        runner: "assets/runner.png",          // Main character image.
        obstacle1: "assets/obstacle1.png",    // First obstacle image.
        obstacle2: "assets/obstacle2.png",    // Second obstacle image.
        background: "assets/background.png", // Gameplay scenery image.
        doodad1: "assets/doodad1.png",        // First decoration image.
        doodad2: "assets/doodad2.png"         // Second decoration image.
    },

    // B. RUNNER: Coordinates use bottom-center anchoring.
    runner: {
        x: 170,                 // Horizontal center in Canvas pixels.
        yOffset: 0,             // Height above the ground at rest.
        maxWidth: 200,          // Maximum image width.
        maxHeight: 100,          // Maximum image height.
        imageOffsetX: 0,        // Positive moves the image right.
        imageOffsetY: 30,        // Positive moves the image down.
        jumpStrength: 1000,      // Initial upward speed (pixels/second).
        gravity: 1800,          // Downward acceleration (pixels/second²).
        hitboxPaddingX: 12,     // Shrink collision area on left/right.
        hitboxPaddingY: 10      // Shrink collision area on top/bottom.
    },

    // C. OBSTACLE 1: A low obstacle.
    obstacle1: {
        maxWidth: 100,
        maxHeight: 150,
        imageOffsetX: 0,
        imageOffsetY: 20,
        groundOffset: 0,       // Positive raises the obstacle.
        hitboxPaddingX: 30,
        hitboxPaddingY: 4
    },

    // D. OBSTACLE 2: A wider obstacle.
    obstacle2: {
        maxWidth: 200,
        maxHeight: 100,
        imageOffsetX: 0,
        imageOffsetY: 30,
        groundOffset: 0,
        hitboxPaddingX: 13,
        hitboxPaddingY: 20
    },

    // E. BACKGROUND: Separately controlled scrolling scenery.
    background: {
        offsetX: 0,                   // Horizontal image offset.
        offsetY: 0,                   // Vertical image offset.
        scale: 1,                     // Multiplier on cover-sized image.
        scrollSpeed: 45,             // Pixels per second.
        fallbackColor: "#bce8ff",   // Sky color if image is missing.
        alignment: "center"          // "top", "center", or "bottom".
    },

    // F. DOODAD 1: Small distant decorations.
    doodad1: {
        x: 35,                 // First decoration's left anchor.
        y: 80,                 // Top anchor in Canvas pixels.
        maxWidth: 70,
        maxHeight: 35,
        imageOffsetX: 0,
        imageOffsetY: 0,
        repeat: true,          // Repeat across the scrolling scene.
        spacing: 230,          // Gap after each decoration.
        scrollSpeed: 22        // Slow distant movement.
    },

    // G. DOODAD 2: Larger foreground decorations.
    doodad2: {
        x: 20,
        y: 238,
        maxWidth: 83,
        maxHeight: 125,
        imageOffsetX: 0,
        imageOffsetY: 0,
        repeat: true,
        spacing: 290,
        scrollSpeed: 85        // Faster nearby movement.
    },

    // H. GAMEPLAY: Speeds and distances use Canvas pixels.
    gameplay: {
        startingSpeed: 295,        // Initial obstacle speed per second.
        maxSpeed: 490,             // Speed cap.
        difficultyIncrease: 5,     // Speed gained per second.
        minObstacleSpacing: 365,   // Minimum gap between obstacles.
        maxObstacleSpacing: 520    // Maximum gap between obstacles.
    },

    // I. DEBUG: Draw actual collision rectangles if enabled.
    debug: {
        showHitboxes: false,
        runnerHitboxColor: "#00FF00",
        obstacleHitboxColor: "#FF0000",
        hitboxLineWidth: 2
    }
};

/* ============================================
   END OF CUSTOMIZATION AND ADJUSTMENT
   GAME LOGIC BELOW
   ============================================ */

// 1. HTML ELEMENTS AND CANVAS
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("scoreDisplay");
const highScoreDisplay = document.getElementById("highScoreDisplay");
const gameOverlay = document.getElementById("gameOverlay");
const overlayMessage = document.getElementById("overlayMessage");
const startButton = document.getElementById("startButton");
const assetStatus = document.getElementById("assetStatus");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = 366;
const HIGH_SCORE_KEY = "jeepney-runner-high-score";
const originalOverlayMessage = overlayMessage.textContent.trim();
const startText = startButton.dataset.startText;
const restartText = startButton.dataset.restartText;

// 2. GAME STATE
let state = "ready"; // ready, playing, gameover
let score = 0;
let highScore = readHighScore();
let speed = CONFIG.gameplay.startingSpeed;
let elapsed = 0;
let lastFrameTime = 0;
let nextObstacleGap = CONFIG.gameplay.maxObstacleSpacing;
let obstacles = [];
let runnerJump = 0;      // Negative values move the runner upward.
let runnerVelocity = 0;
let animationFrameId = null;

// 3. OPTIONAL IMAGE LOADING
// An unavailable PNG never prevents the game from running.
const images = {};
const assetNames = [
    "runner", "obstacle1", "obstacle2",
    "background", "doodad1", "doodad2"
];
let pendingImages = assetNames.length;
let loadedImages = 0;

assetNames.forEach((name) => {
    const image = new Image();
    images[name] = null;

    image.onload = () => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            images[name] = image;
            loadedImages++;
        }
        updateAssetStatus();
    };
    image.onerror = updateAssetStatus;
    image.src = CONFIG.assets[name];
});

function updateAssetStatus() {
    pendingImages--;
    if (pendingImages === 0) {
        assetStatus.textContent = loadedImages === assetNames.length
            ? "All image assets loaded."
            : `${loadedImages} of ${assetNames.length} images loaded; Canvas drawings fill in the rest.`;
    }
}

// 4. LOCAL HIGH SCORE
function readHighScore() {
    try {
        const value = Number(localStorage.getItem(HIGH_SCORE_KEY));
        return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (error) {
        return 0;
    }
}

function saveHighScore() {
    try {
        localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    } catch (error) {
        // The game still works when storage is blocked.
    }
}

function displayScores() {
    scoreDisplay.textContent = String(Math.floor(score));
    highScoreDisplay.textContent = String(Math.floor(highScore));
}

// 5. IMAGE SIZING AND DRAWING
// Images fit inside limits without stretching or changing anchors.
function fittedSize(name, maxWidth, maxHeight) {
    const image = images[name];
    if (!image) return { width: maxWidth, height: maxHeight };
    const ratio = Math.min(
        maxWidth / image.naturalWidth,
        maxHeight / image.naturalHeight
    );
    return {
        width: image.naturalWidth * ratio,
        height: image.naturalHeight * ratio
    };
}

function drawAsset(name, x, y, width, height, fallback) {
    if (images[name]) {
        ctx.drawImage(images[name], x, y, width, height);
    } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(width, height);
        fallback(); // Fallback functions draw in a 0..1 coordinate system.
        ctx.restore();
    }
}

function boxFor(anchorX, bottomY, name, settings) {
    const size = fittedSize(name, settings.maxWidth, settings.maxHeight);
    return {
        x: anchorX - size.width / 2 + settings.imageOffsetX,
        y: bottomY - size.height + settings.imageOffsetY,
        width: size.width,
        height: size.height
    };
}

function runnerBox() {
    return boxFor(
        CONFIG.runner.x,
        GROUND_Y - CONFIG.runner.yOffset + runnerJump,
        "runner", CONFIG.runner
    );
}

function obstacleBox(obstacle) {
    const settings = CONFIG[obstacle.type];
    return boxFor(
        obstacle.x,
        GROUND_Y - settings.groundOffset,
        obstacle.type, settings
    );
}

function collisionBox(box, settings) {
    const px = Math.max(0, Math.min(settings.hitboxPaddingX, box.width / 2));
    const py = Math.max(0, Math.min(settings.hitboxPaddingY, box.height / 2));
    return {
        x: box.x + px,
        y: box.y + py,
        width: box.width - 2 * px,
        height: box.height - 2 * py
    };
}

function overlaps(a, b) {
    return a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
        a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
}

function drawHitbox(box, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = CONFIG.debug.hitboxLineWidth;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
}

// 6. FALLBACK DRAWINGS
// All fallback drawing coordinates are normalized from 0 to 1.
function fallbackRunner() {
    // Blue-and-orange vehicle body, windows, bumper, and wheels.
    ctx.fillStyle = "#f28b24";
    ctx.fillRect(.05, .27, .9, .52);
    ctx.fillStyle = "#1763b5";
    ctx.fillRect(.11, .10, .72, .29);
    ctx.fillStyle = "#d9f6ff";
    ctx.fillRect(.16, .14, .23, .20);
    ctx.fillRect(.44, .14, .24, .20);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(.1, .51, .8, .10);
    ctx.fillStyle = "#1b385c";
    ctx.fillRect(.01, .73, .98, .09);
    ctx.fillStyle = "#263747";
    ctx.beginPath(); ctx.arc(.24, .83, .115, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(.77, .83, .115, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#dde6eb";
    ctx.beginPath(); ctx.arc(.24, .83, .05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(.77, .83, .05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffeb9b";
    ctx.fillRect(.88, .42, .07, .1);
}

function fallbackObstacle1() {
    ctx.fillStyle = "#fa831d";
    ctx.beginPath();
    ctx.moveTo(.50, .03); ctx.lineTo(.12, .82);
    ctx.lineTo(.88, .82); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(.35, .46, .30, .10);
    ctx.fillRect(.27, .65, .46, .08);
    ctx.fillStyle = "#22539c";
    ctx.fillRect(.02, .82, .96, .16);
}

function fallbackObstacle2() {
    ctx.fillStyle = "#2165b0";
    ctx.fillRect(.06, .28, .88, .50);
    ctx.fillStyle = "#f9a33a";
    ctx.fillRect(.10, .12, .68, .25);
    ctx.fillStyle = "#d9f4ff";
    ctx.fillRect(.17, .17, .22, .17);
    ctx.fillRect(.44, .17, .23, .17);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(.13, .57, .75, .09);
    ctx.fillStyle = "#263747";
    ctx.beginPath(); ctx.arc(.23, .81, .12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(.76, .81, .12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e7edf2";
    ctx.beginPath(); ctx.arc(.23, .81, .05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(.76, .81, .05, 0, Math.PI * 2); ctx.fill();
}

function fallbackDoodad1() {
    // Two stylized birds flying in the distance.
    ctx.strokeStyle = "#2c5e80";
    ctx.lineWidth = .055;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(.08, .48); ctx.quadraticCurveTo(.27, .10, .46, .49);
    ctx.quadraticCurveTo(.65, .10, .84, .48);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(.47, .80); ctx.quadraticCurveTo(.58, .59, .68, .80);
    ctx.quadraticCurveTo(.80, .59, .91, .80);
    ctx.stroke();
}

function fallbackDoodad2() {
    // A leafy tree with a visible trunk.
    ctx.fillStyle = "#8a5934";
    ctx.fillRect(.44, .50, .15, .49);
    ctx.fillStyle = "#2e9c60";
    ctx.beginPath(); ctx.arc(.36, .40, .28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(.66, .38, .27, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#43b56d";
    ctx.beginPath(); ctx.arc(.50, .23, .31, 0, Math.PI * 2); ctx.fill();
}

function fallbackBackground(tileX, tileWidth) {
    // The skyline is drawn in repeatable tiles; road remains aligned.
    ctx.fillStyle = CONFIG.background.fallbackColor;
    ctx.fillRect(tileX, 0, tileWidth, HEIGHT);
    const left = tileX;
    const step = tileWidth / 6;
    for (let i = 0; i < 6; i++) {
        const buildingHeight = [160, 120, 185, 142, 170, 125][i];
        const x = left + i * step;
        ctx.fillStyle = i % 2 ? "#aac4db" : "#87b0ce";
        ctx.fillRect(x, GROUND_Y - buildingHeight, step + 1, buildingHeight);
        ctx.fillStyle = "#eaf7ff";
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 2; col++) {
                ctx.fillRect(x + step * (.18 + .4 * col),
                    GROUND_Y - buildingHeight + 25 + row * 35, 11, 16);
            }
        }
    }
    ctx.fillStyle = "#6a7888";
    ctx.fillRect(left, GROUND_Y, tileWidth + 1, HEIGHT - GROUND_Y);
    ctx.fillStyle = "#f7f7f7";
    ctx.fillRect(left, GROUND_Y + 7, tileWidth + 1, 4);
    ctx.fillStyle = "#ffd56b";
    ctx.fillRect(left + tileWidth * .2, GROUND_Y + 55, tileWidth * .18, 5);
    ctx.fillRect(left + tileWidth * .7, GROUND_Y + 55, tileWidth * .18, 5);
}

// 7. SCROLLING BACKGROUND
function drawBackground() {
    const image = images.background;
    const offset = elapsed * CONFIG.background.scrollSpeed;
    const extraX = CONFIG.background.offsetX;
    const extraY = CONFIG.background.offsetY;

    if (!image) {
        const tileWidth = 480 * Math.max(.1, CONFIG.background.scale);
        const phase = ((offset - extraX) % tileWidth + tileWidth) % tileWidth;
        for (let x = -phase - tileWidth; x < WIDTH; x += tileWidth) {
            ctx.save();
            ctx.translate(0, extraY);
            fallbackBackground(x, tileWidth);
            ctx.restore();
        }
        return;
    }

    const scale = Math.max(
        WIDTH / image.naturalWidth,
        HEIGHT / image.naturalHeight
    ) * Math.max(.1, CONFIG.background.scale);
    const tileWidth = image.naturalWidth * scale;
    const tileHeight = image.naturalHeight * scale;
    let y = (HEIGHT - tileHeight) / 2;
    if (CONFIG.background.alignment === "top") y = 0;
    if (CONFIG.background.alignment === "bottom") y = HEIGHT - tileHeight;
    y += extraY;

    const phase = ((offset - extraX) % tileWidth + tileWidth) % tileWidth;
    for (let x = -phase - tileWidth; x < WIDTH; x += tileWidth) {
        ctx.drawImage(image, x, y, tileWidth + .5, tileHeight);
    }
}

// 8. INDEPENDENT DECORATIVE LAYERS
function drawDoodad(name, fallback) {
    const settings = CONFIG[name];
    const size = fittedSize(name, settings.maxWidth, settings.maxHeight);
    const x = settings.x + settings.imageOffsetX;
    const y = settings.y + settings.imageOffsetY;
    const drawOne = (drawX) => drawAsset(name, drawX, y,
        size.width, size.height, fallback);

    if (!settings.repeat) {
        drawOne(x);
        return;
    }

    const period = Math.max(1, size.width + settings.spacing);
    const movedX = x - elapsed * settings.scrollSpeed;
    const first = Math.floor((-movedX - size.width) / period);
    const last = Math.ceil((WIDTH - movedX) / period);
    for (let i = first; i <= last; i++) {
        drawOne(movedX + i * period);
    }
}

// 9. OBSTACLES AND DIFFICULTY
function randomGap() {
    const minimum = Math.max(
        CONFIG.gameplay.minObstacleSpacing,
        speed * 1.05 + CONFIG.obstacle2.maxWidth
    );
    const maximum = Math.max(minimum, CONFIG.gameplay.maxObstacleSpacing);
    return minimum + Math.random() * (maximum - minimum);
}

function spawnObstacle(x) {
    obstacles.push({
        type: Math.random() < .55 ? "obstacle1" : "obstacle2",
        x,
        passed: false
    });
}

function updateGame(dt) {
    elapsed += dt;
    speed = Math.min(CONFIG.gameplay.maxSpeed,
        speed + CONFIG.gameplay.difficultyIncrease * dt);

    // Jump with gravity; do not permit a second jump midair.
    if (runnerJump < 0 || runnerVelocity < 0) {
        runnerVelocity += CONFIG.runner.gravity * dt;
        runnerJump += runnerVelocity * dt;
        if (runnerJump >= 0) {
            runnerJump = 0;
            runnerVelocity = 0;
        }
    }

    // Track distance to the next obstacle in world pixels.
    nextObstacleGap -= speed * dt;
    if (nextObstacleGap <= 0) {
        spawnObstacle(WIDTH + CONFIG.obstacle2.maxWidth);
        nextObstacleGap = randomGap();
    }

    const hitbox = collisionBox(runnerBox(), CONFIG.runner);
    for (const obstacle of obstacles) {
        obstacle.x -= speed * dt;
        const box = obstacleBox(obstacle);
        if (overlaps(hitbox, collisionBox(box, CONFIG[obstacle.type]))) {
            endGame();
            return;
        }
        if (!obstacle.passed && box.x + box.width < hitbox.x) {
            obstacle.passed = true;
            score += 15;
        }
    }
    obstacles = obstacles.filter(obstacle =>
        obstacleBox(obstacle).x + obstacleBox(obstacle).width > -20);

    score += dt * 10;
    if (score > highScore) {
        highScore = score;
    }
    displayScores();
}

// 10. RENDER GAME OBJECTS
function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground();
    drawDoodad("doodad1", fallbackDoodad1);
    drawDoodad("doodad2", fallbackDoodad2);

    for (const obstacle of obstacles) {
        const box = obstacleBox(obstacle);
        const fallback = obstacle.type === "obstacle1"
            ? fallbackObstacle1 : fallbackObstacle2;
        drawAsset(obstacle.type, box.x, box.y, box.width, box.height, fallback);
        if (CONFIG.debug.showHitboxes) {
            drawHitbox(collisionBox(box, CONFIG[obstacle.type]),
                CONFIG.debug.obstacleHitboxColor);
        }
    }

    const box = runnerBox();
    drawAsset("runner", box.x, box.y, box.width, box.height, fallbackRunner);
    if (CONFIG.debug.showHitboxes) {
        drawHitbox(collisionBox(box, CONFIG.runner),
            CONFIG.debug.runnerHitboxColor);
    }
}

// 11. GAME CONTROLS
function startGame() {
    state = "playing";
    score = 0;
    speed = CONFIG.gameplay.startingSpeed;
    elapsed = 0;
    runnerJump = 0;
    runnerVelocity = 0;
    obstacles = [];
    nextObstacleGap = CONFIG.gameplay.maxObstacleSpacing;
    gameOverlay.hidden = true;
    overlayMessage.textContent = originalOverlayMessage;
    startButton.textContent = restartText;
    displayScores();
    lastFrameTime = performance.now();
}

function jump() {
    if (state !== "playing") return;
    if (runnerJump === 0 && runnerVelocity === 0) {
        runnerVelocity = -CONFIG.runner.jumpStrength;
    }
}

function endGame() {
    state = "gameover";
    saveHighScore();
    displayScores();
    overlayMessage.textContent = `${originalOverlayMessage} Final score: ${Math.floor(score)}.`;
    gameOverlay.hidden = false;
    startButton.textContent = restartText;
}

startButton.addEventListener("click", startGame);

window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "ArrowUp") return;
    event.preventDefault();
    if (event.repeat) return;
    jump();
});

canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    jump();
});

// 12. SINGLE ANIMATION LOOP
function gameLoop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000 || 0, .033);
    lastFrameTime = now;
    if (state === "playing") updateGame(dt);
    render();
    animationFrameId = requestAnimationFrame(gameLoop);
}

startButton.textContent = startText;
displayScores();
animationFrameId = requestAnimationFrame(gameLoop);
