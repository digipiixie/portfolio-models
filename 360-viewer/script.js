const image = document.getElementById("model");

const totalFrames = 144;

// Lower number = faster drag response
const dragSensitivity = 6;

// Lower number = faster automatic rotation
const autoplaySpeed = 70;

// How long to wait after dragging before autoplay resumes
const resumeDelay = 1200;

let currentFrame = 1;
let dragging = false;
let previousX = 0;
let accumulatedMovement = 0;

let autoplayTimer = null;
let resumeTimer = null;

function framePath(frameNumber) {
    const paddedFrame = String(frameNumber).padStart(4, "0");

    return `frames/360-model-spin${paddedFrame}.webp`;
}

function updateImage() {
    image.src = framePath(currentFrame);
}

function nextFrame() {
    currentFrame++;

    if (currentFrame > totalFrames) {
        currentFrame = 1;
    }

    updateImage();
}

function previousFrame() {
    currentFrame--;

    if (currentFrame < 1) {
        currentFrame = totalFrames;
    }

    updateImage();
}

function startAutoplay() {
    stopAutoplay();

    autoplayTimer = setInterval(() => {
        if (!dragging) {
            nextFrame();
        }
    }, autoplaySpeed);
}

function stopAutoplay() {
    if (autoplayTimer !== null) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
    }
}

function scheduleAutoplayResume() {
    clearTimeout(resumeTimer);

    resumeTimer = setTimeout(() => {
        startAutoplay();
    }, resumeDelay);
}

// Preload every frame
for (let frame = 1; frame <= totalFrames; frame++) {
    const preloadImage = new Image();
    preloadImage.src = framePath(frame);
}

image.addEventListener("pointerdown", (event) => {
    dragging = true;
    previousX = event.clientX;
    accumulatedMovement = 0;

    stopAutoplay();
    clearTimeout(resumeTimer);

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
            previousFrame();
            accumulatedMovement -= dragSensitivity;
        } else {
            nextFrame();
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
        event &&
        typeof event.pointerId !== "undefined" &&
        image.hasPointerCapture(event.pointerId)
    ) {
        image.releasePointerCapture(event.pointerId);
    }

    scheduleAutoplayResume();
}

image.addEventListener("pointerup", stopDragging);
image.addEventListener("pointercancel", stopDragging);
image.addEventListener("lostpointercapture", stopDragging);

image.addEventListener("dragstart", (event) => {
    event.preventDefault();
});

updateImage();
startAutoplay();
