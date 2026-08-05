const image = document.getElementById("model");

const totalFrames = 144;

// Automatic playback speed.
// 30 means the viewer displays about 30 frames every second.
const autoplayFPS = 30;

// Number of pixels dragged before moving one frame.
// Lower = more responsive dragging.
const dragSensitivity = 4;

// Time before autoplay resumes after dragging.
const resumeDelay = 1000;

let currentFrame = 1;
let dragging = false;
let previousX = 0;
let accumulatedMovement = 0;

let autoplayEnabled = false;
let resumeTimer = null;
let lastFrameTime = 0;

const loadedFrames = [];
let loadedCount = 0;

function framePath(frameNumber) {
    const paddedFrame = String(frameNumber).padStart(4, "0");
    return `frames/360-model-spin${paddedFrame}.webp`;
}

function displayFrame(frameNumber) {
    currentFrame = frameNumber;

    if (currentFrame > totalFrames) {
        currentFrame = 1;
    }

    if (currentFrame < 1) {
        currentFrame = totalFrames;
    }

    image.src = framePath(currentFrame);
}

function preloadFrames() {
    for (let frame = 1; frame <= totalFrames; frame++) {
        const preloadImage = new Image();

        preloadImage.onload = () => {
            loadedCount++;

            if (loadedCount === totalFrames) {
                autoplayEnabled = true;
            }
        };

        preloadImage.onerror = () => {
            console.error(`Could not load frame ${frame}`);
        };

        preloadImage.src = framePath(frame);
        loadedFrames.push(preloadImage);
    }
}

function autoplay(timestamp) {
    const frameDuration = 1000 / autoplayFPS;

    if (
        autoplayEnabled &&
        !dragging &&
        timestamp - lastFrameTime >= frameDuration
    ) {
        displayFrame(currentFrame + 1);
        lastFrameTime = timestamp;
    }

    requestAnimationFrame(autoplay);
}

function pauseAutoplay() {
    autoplayEnabled = false;
    clearTimeout(resumeTimer);
}

function resumeAutoplayLater() {
    clearTimeout(resumeTimer);

    resumeTimer = setTimeout(() => {
        autoplayEnabled = true;
        lastFrameTime = performance.now();
    }, resumeDelay);
}

image.addEventListener("pointerdown", (event) => {
    dragging = true;
    previousX = event.clientX;
    accumulatedMovement = 0;

    pauseAutoplay();

    image.setPointerCapture(event.pointerId);
    image.classList.add("dragging");
});

image.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    const movement = event.clientX - previousX;

    accumulatedMovement += movement;
    previousX = event.clientX;

    while (Math.abs(accumulatedMovement) >= dragSensitivity) {
        if (accumulatedMovement > 0) {
            displayFrame(currentFrame - 1);
            accumulatedMovement -= dragSensitivity;
        } else {
            displayFrame(currentFrame + 1);
            accumulatedMovement += dragSensitivity;
        }
    }
});

function stopDragging(event) {
    if (!dragging) return;

    dragging = false;
    accumulatedMovement = 0;
    image.classList.remove("dragging");

    if (
        typeof event.pointerId !== "undefined" &&
        image.hasPointerCapture(event.pointerId)
    ) {
        image.releasePointerCapture(event.pointerId);
    }

    resumeAutoplayLater();
}

image.addEventListener("pointerup", stopDragging);
image.addEventListener("pointercancel", stopDragging);
image.addEventListener("lostpointercapture", stopDragging);

image.addEventListener("dragstart", (event) => {
    event.preventDefault();
});

displayFrame(1);
preloadFrames();
requestAnimationFrame(autoplay);
