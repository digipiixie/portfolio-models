"use strict";

/*
==========================================================
MODEL SETTINGS
==========================================================

For future model viewers, these are the main settings
you will change.
*/

const SETTINGS = {
    frameFolder: "frames",
    framePrefix: "360-model-spin",
    frameExtension: "webp",

    totalFrames: 298,
    numberPadding: 4,

    autoplay: true,

    /*
    How quickly the model rotates automatically.

    18 = slow
    24 = balanced
    30 = faster
    */
    autoplayFPS: 24,

    /*
    Lower number = more sensitive dragging.

    2 = very sensitive
    3 = balanced
    5 = slower dragging
    */
    pixelsPerFrame: 3,

    /*
    Higher number = stronger momentum after releasing.
    */
    inertiaMultiplier: 1,

    /*
    Smaller number = momentum lasts longer.

    0.90 = stops fairly quickly
    0.94 = balanced
    0.97 = spins for longer
    */
    inertiaFriction: 0.94,

    /*
    Time before automatic rotation resumes after dragging.
    */
    autoplayResumeDelay: 1400,

    /*
    How long the drag instruction remains visible
    if the visitor does not interact.
    */
    instructionDuration: 5000
};


/*
==========================================================
PAGE ELEMENTS
==========================================================
*/

const viewer = document.getElementById("viewer");
const modelImage = document.getElementById("model");

const loadingScreen =
    document.getElementById("loadingScreen");

const loadingProgress =
    document.getElementById("loadingProgress");

const loadingPercentage =
    document.getElementById("loadingPercentage");

const dragInstruction =
    document.getElementById("dragInstruction");


/*
==========================================================
VIEWER STATE
==========================================================
*/

let currentFrame = 1;
let framePosition = 1;

let isDragging = false;
let isReady = false;

let previousPointerX = 0;
let previousPointerTime = 0;

let inertiaVelocity = 0;

let autoplayEnabled = false;
let autoplayResumeTimer = null;

let lastAnimationTime = performance.now();

let loadedFrameCount = 0;
let failedFrameCount = 0;

const preloadedImages = [];


/*
==========================================================
FRAME PATH
==========================================================
*/

function getFramePath(frameNumber) {
    const paddedNumber =
        String(frameNumber).padStart(
            SETTINGS.numberPadding,
            "0"
        );

    return (
        `${SETTINGS.frameFolder}/` +
        `${SETTINGS.framePrefix}` +
        `${paddedNumber}.` +
        `${SETTINGS.frameExtension}`
    );
}


/*
==========================================================
FRAME HELPERS
==========================================================
*/

function wrapFramePosition(position) {
    const frameCount = SETTINGS.totalFrames;

    while (position < 1) {
        position += frameCount;
    }

    while (position > frameCount) {
        position -= frameCount;
    }

    return position;
}


function showFrame(frameNumber) {
    const wrappedFrame =
        Math.round(
            wrapFramePosition(frameNumber)
        );

    if (wrappedFrame === currentFrame) {
        return;
    }

    currentFrame = wrappedFrame;

    modelImage.src =
        getFramePath(currentFrame);
}


/*
==========================================================
LOADING
==========================================================
*/

function updateLoadingDisplay() {
    const completedFrames =
        loadedFrameCount + failedFrameCount;

    const percentage =
        Math.round(
            (
                completedFrames /
                SETTINGS.totalFrames
            ) * 100
        );

    loadingProgress.style.width =
        `${percentage}%`;

    loadingPercentage.textContent =
        `${percentage}%`;
}


function finishLoading() {
    isReady = true;

    viewer.classList.add("is-ready");
    loadingScreen.classList.add("is-hidden");

    framePosition = 1;
    currentFrame = 0;

    showFrame(1);

    autoplayEnabled = SETTINGS.autoplay;

    window.setTimeout(() => {
        dragInstruction.classList.add("is-hidden");
    }, SETTINGS.instructionDuration);
}


function preloadAllFrames() {
    for (
        let frameNumber = 1;
        frameNumber <= SETTINGS.totalFrames;
        frameNumber++
    ) {
        const preloadImage = new Image();

        preloadImage.onload = () => {
            loadedFrameCount++;
            updateLoadingDisplay();

            const completedFrames =
                loadedFrameCount +
                failedFrameCount;

            if (
                completedFrames ===
                SETTINGS.totalFrames
            ) {
                finishLoading();
            }
        };

        preloadImage.onerror = () => {
            failedFrameCount++;
            updateLoadingDisplay();

            console.error(
                "Could not load frame:",
                getFramePath(frameNumber)
            );

            const completedFrames =
                loadedFrameCount +
                failedFrameCount;

            if (
                completedFrames ===
                SETTINGS.totalFrames
            ) {
                finishLoading();
            }
        };

        preloadImage.src =
            getFramePath(frameNumber);

        preloadedImages.push(preloadImage);
    }
}


/*
==========================================================
AUTOPLAY
==========================================================
*/

function pauseAutoplay() {
    autoplayEnabled = false;

    window.clearTimeout(
        autoplayResumeTimer
    );
}


function scheduleAutoplayResume() {
    window.clearTimeout(
        autoplayResumeTimer
    );

    autoplayResumeTimer =
        window.setTimeout(() => {
            if (
                SETTINGS.autoplay &&
                !isDragging
            ) {
                autoplayEnabled = true;
            }
        }, SETTINGS.autoplayResumeDelay);
}


/*
==========================================================
DRAG INSTRUCTION
==========================================================
*/

function hideDragInstruction() {
    dragInstruction.classList.add("is-hidden");
}


/*
==========================================================
POINTER INTERACTION
==========================================================
*/

viewer.addEventListener(
    "pointerdown",
    (event) => {
        if (!isReady) {
            return;
        }

        isDragging = true;

        previousPointerX = event.clientX;
        previousPointerTime =
            performance.now();

        inertiaVelocity = 0;

        pauseAutoplay();
        hideDragInstruction();

        viewer.classList.add("is-dragging");

        viewer.setPointerCapture(
            event.pointerId
        );
    }
);


viewer.addEventListener(
    "pointermove",
    (event) => {
        if (!isDragging || !isReady) {
            return;
        }

        const currentTime =
            performance.now();

        const movementX =
            event.clientX -
            previousPointerX;

        const elapsedTime =
            Math.max(
                currentTime -
                previousPointerTime,
                1
            );

        const frameMovement =
            -movementX /
            SETTINGS.pixelsPerFrame;

        framePosition =
            wrapFramePosition(
                framePosition +
                frameMovement
            );

        /*
        Store movement speed as frames per millisecond.
        This becomes the momentum after release.
        */

        inertiaVelocity =
            (
                frameMovement /
                elapsedTime
            ) *
            SETTINGS.inertiaMultiplier;

        previousPointerX =
            event.clientX;

        previousPointerTime =
            currentTime;

        showFrame(framePosition);
    }
);


function stopDragging(event) {
    if (!isDragging) {
        return;
    }

    isDragging = false;

    viewer.classList.remove("is-dragging");

    if (
        event &&
        typeof event.pointerId !==
            "undefined" &&
        viewer.hasPointerCapture(
            event.pointerId
        )
    ) {
        viewer.releasePointerCapture(
            event.pointerId
        );
    }

    scheduleAutoplayResume();
}


viewer.addEventListener(
    "pointerup",
    stopDragging
);

viewer.addEventListener(
    "pointercancel",
    stopDragging
);

viewer.addEventListener(
    "lostpointercapture",
    stopDragging
);

viewer.addEventListener(
    "dragstart",
    (event) => {
        event.preventDefault();
    }
);


/*
==========================================================
KEYBOARD SUPPORT
==========================================================
*/

window.addEventListener(
    "keydown",
    (event) => {
        if (!isReady) {
            return;
        }

        if (event.key === "ArrowLeft") {
            pauseAutoplay();

            framePosition =
                wrapFramePosition(
                    framePosition - 1
                );

            showFrame(framePosition);
            scheduleAutoplayResume();
        }

        if (event.key === "ArrowRight") {
            pauseAutoplay();

            framePosition =
                wrapFramePosition(
                    framePosition + 1
                );

            showFrame(framePosition);
            scheduleAutoplayResume();
        }
    }
);


/*
==========================================================
MAIN ANIMATION LOOP
==========================================================
*/

function animationLoop(timestamp) {
    const elapsedMilliseconds =
        Math.min(
            timestamp -
            lastAnimationTime,
            50
        );

    lastAnimationTime = timestamp;

    if (isReady && !isDragging) {
        /*
        Momentum after releasing the model.
        */

        if (
            Math.abs(inertiaVelocity) >
            0.0005
        ) {
            framePosition =
                wrapFramePosition(
                    framePosition +
                    (
                        inertiaVelocity *
                        elapsedMilliseconds
                    )
                );

            const friction =
                Math.pow(
                    SETTINGS.inertiaFriction,
                    elapsedMilliseconds /
                    16.67
                );

            inertiaVelocity *= friction;

            showFrame(framePosition);
        } else {
            inertiaVelocity = 0;

            /*
            Automatic idle rotation.
            */

            if (autoplayEnabled) {
                const framesPerMillisecond =
                    SETTINGS.autoplayFPS /
                    1000;

                framePosition =
                    wrapFramePosition(
                        framePosition +
                        (
                            framesPerMillisecond *
                            elapsedMilliseconds
                        )
                    );

                showFrame(framePosition);
            }
        }
    }

    window.requestAnimationFrame(
        animationLoop
    );
}


/*
==========================================================
START VIEWER
==========================================================
*/

updateLoadingDisplay();
preloadAllFrames();

window.requestAnimationFrame(
    animationLoop
);
