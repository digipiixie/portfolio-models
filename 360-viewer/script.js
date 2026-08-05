const image = document.getElementById("model");

const totalFrames = 144;

let currentFrame = 1;
let dragging = false;
let previousX = 0;

function updateImage() {
    const frame = String(currentFrame).padStart(3, "0");
    image.src = `frames/360-spin-model.${frame}.webp`;
}

image.addEventListener("pointerdown", (event) => {
    dragging = true;
    previousX = event.clientX;

    image.setPointerCapture(event.pointerId);
});

window.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    const movement = event.clientX - previousX;

    // Change frame every 5 pixels dragged
    if (Math.abs(movement) >= 5) {

        if (movement > 0) {
            currentFrame--;
        } else {
            currentFrame++;
        }

        if (currentFrame < 1) {
            currentFrame = totalFrames;
        }

        if (currentFrame > totalFrames) {
            currentFrame = 1;
        }

        updateImage();
        previousX = event.clientX;
    }
});

window.addEventListener("pointerup", () => {
    dragging = false;
});
