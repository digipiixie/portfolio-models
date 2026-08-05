const image = document.getElementById("model");

const totalFrames = 144;
const dragSensitivity = 6;

let currentFrame = 1;
let dragging = false;
let previousX = 0;
let accumulatedMovement = 0;

function framePath(frameNumber) {
    const paddedFrame = String(frameNumber).padStart(4, "0");
    return `frames/360-model-spin${paddedFrame}.webp`;
}

function updateImage() {
    image.src = framePath(currentFrame);
}

function wrapFrame(frameNumber) {
    if (frameNumber < 1) {
        return totalFrames;
    }

    if (frameNumber > totalFrames) {
        return 1;
    }

    return frameNumber;
}

/* Preload all frames so dragging does not flicker */
for (let frame = 1; frame <= totalFrames; frame++) {
    const preloadImage = new Image();
    preloadImage.src = framePath(frame);
}

image.addEventListener("pointerdown", (event) => {
    dragging = true;
    previousX = event.clientX;
    accumulatedMovement = 0;

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
            currentFrame = wrapFrame(currentFrame - 1);
            accumulatedMovement -= dragSensitivity;
        } else {
            currentFrame = wrapFrame(currentFrame + 1);
            accumulatedMovement += dragSensitivity;
        }

        updateImage();
    }
});

function stopDragging(event) {
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
}

image.addEventListener("pointerup", stopDragging);
image.addEventListener("pointercancel", stopDragging);
image.addEventListener("lostpointercapture", stopDragging);

image.addEventListener("dragstart", (event) => {
    event.preventDefault();
});

updateImage();
