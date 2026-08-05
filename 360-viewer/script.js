"use strict";

/* ======================================================
   SETTINGS
====================================================== */

const SETTINGS = {
    frameFolder: "frames",
    framePrefix: "360-model-spin",
    frameExtension: "webp",

    totalFrames: 298,
    numberPadding: 4,

    autoplay: true,
    autoplayFPS: 24,

    pixelsPerFrame: 3,

    inertiaMultiplier: 1,
    inertiaFriction: 0.94,

    autoplayResumeDelay: 1400,
    instructionDuration: 5000,

    mobileButtonFrameStep: 5,
    mobileHoldInterval: 75,

    /*
    The viewer opens after this many frames load.
    The remaining frames continue loading quietly.
    */
    minimumFramesBeforeOpening: 18,

    /*
    Failsafe: reveal the viewer after this amount of time,
    even if some image requests are still pending.
    */
    maximumLoadingTime: 8000,

    /*
    Limit simultaneous image downloads to avoid
    overwhelming a Carrd iframe.
    */
    preloadConcurrency: 6,

    /*
    Prevent an individual frame request from hanging
    a preload worker forever.
    */
    individualFrameTimeout: 10000
};

/* ======================================================
   PAGE ELEMENTS
====================================================== */

const viewer =
    document.getElementById("viewer");

const modelImage =
    document.getElementById("model");

const loadingScreen =
    document.getElementById("loadingScreen");

const loadingProgress =
    document.getElementById("loadingProgress");

const loadingPercentage =
    document.getElementById("loadingPercentage");

const loadingStatus =
    document.getElementById("loadingStatus");

const dragInstruction =
    document.getElementById("dragInstruction");

const closeInstructionButton =
    document.getElementById(
        "closeInstructionButton"
    );

const characterFileWindow =
    document.getElementById(
        "characterFileWindow"
    );

const characterFileButton =
    document.getElementById(
        "characterFileButton"
    );

const minimizeCharacterButton =
    document.getElementById(
        "minimizeCharacterButton"
    );

const rotateLeftButton =
    document.getElementById(
        "rotateLeftButton"
    );

const rotateRightButton =
    document.getElementById(
        "rotateRightButton"
    );

/* ======================================================
   STATE
====================================================== */

let currentFrame = 1;
let framePosition = 1;

let isReady = false;
let isDragging = false;

let previousPointerX = 0;
let previousPointerTime = 0;

let inertiaVelocity = 0;

let autoplayEnabled = false;
let autoplayResumeTimer = null;

let lastAnimationTime =
    performance.now();

let loadedFrameCount = 0;
let completedFrameCount = 0;
let failedFrameCount = 0;

let nextFrameToLoad = 1;

let mobileHoldTimer = null;

const preloadedImages = [];
const loadedFrames = new Set();

/* ======================================================
   BASIC SAFETY CHECK
====================================================== */

if (!viewer || !modelImage) {
    throw new Error(
        "DIGI PIXIE OS could not find the viewer elements."
    );
}

/* ======================================================
   FRAME PATH
====================================================== */

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

/* ======================================================
   FRAME HELPERS
====================================================== */

function wrapFramePosition(position) {
    while (position < 1) {
        position += SETTINGS.totalFrames;
    }

    while (position > SETTINGS.totalFrames) {
        position -= SETTINGS.totalFrames;
    }

    return position;
}

function showFrame(frameNumber) {
    const wrappedFrame =
        Math.round(
            wrapFramePosition(frameNumber)
        );

    if (
        wrappedFrame === currentFrame &&
        modelImage.src
    ) {
        return;
    }

    currentFrame = wrappedFrame;

    modelImage.src =
        getFramePath(currentFrame);
}

function rotateByFrames(amount) {
    if (!isReady) {
        return;
    }

    pauseAutoplay();

    inertiaVelocity = 0;

    framePosition =
        wrapFramePosition(
            framePosition + amount
        );

    showFrame(framePosition);

    scheduleAutoplayResume();
}

/* ======================================================
   LOADING DISPLAY
====================================================== */

function updateLoadingDisplay() {
    const percentage =
        Math.min(
            100,
            Math.round(
                (
                    completedFrameCount /
                    SETTINGS.totalFrames
                ) * 100
            )
        );

    if (loadingProgress) {
        loadingProgress.style.width =
            `${percentage}%`;
    }

    if (loadingPercentage) {
        loadingPercentage.textContent =
            `${percentage}%`;
    }

    if (!loadingStatus) {
        return;
    }

    if (percentage < 20) {
        loadingStatus.textContent =
            "Reading Character.FBX...";
    } else if (percentage < 45) {
        loadingStatus.textContent =
            "Loading materials...";
    } else if (percentage < 70) {
        loadingStatus.textContent =
            "Preparing viewport...";
    } else if (percentage < 100) {
        loadingStatus.textContent =
            "Loading remaining frames...";
    } else {
        loadingStatus.textContent =
            "Character ready!";
    }
}

function finishLoading() {
    if (isReady) {
        return;
    }

    isReady = true;

    viewer.classList.add("is-ready");

    if (loadingScreen) {
        loadingScreen.classList.add(
            "is-hidden"
        );
    }

    framePosition = 1;
    currentFrame = 0;

    showFrame(1);

    autoplayEnabled =
        SETTINGS.autoplay;

    window.setTimeout(() => {
        if (
            dragInstruction &&
            !dragInstruction.classList.contains(
                "is-closed"
            )
        ) {
            dragInstruction.classList.add(
                "is-hidden"
            );
        }
    }, SETTINGS.instructionDuration);
}

function checkIfViewerCanOpen() {
    if (
        !isReady &&
        loadedFrameCount >=
            SETTINGS.minimumFramesBeforeOpening
    ) {
        finishLoading();
    }
}

/* ======================================================
   SAFE PROGRESSIVE PRELOADING
====================================================== */

function loadSingleFrame(frameNumber) {
    return new Promise((resolve) => {
        const preloadImage =
            new Image();

        let requestFinished = false;

        const finishRequest =
            (successful) => {

                if (requestFinished) {
                    return;
                }

                requestFinished = true;

                window.clearTimeout(
                    timeoutId
                );

                completedFrameCount++;

                if (successful) {
                    loadedFrameCount++;

                    loadedFrames.add(
                        frameNumber
                    );
                } else {
                    failedFrameCount++;
                }

                updateLoadingDisplay();
                checkIfViewerCanOpen();

                resolve();
            };

        const timeoutId =
            window.setTimeout(() => {

                console.warn(
                    "Frame preload timed out:",
                    getFramePath(frameNumber)
                );

                finishRequest(false);

            }, SETTINGS.individualFrameTimeout);

        preloadImage.onload = () => {
            finishRequest(true);
        };

        preloadImage.onerror = () => {

            console.warn(
                "Could not preload frame:",
                getFramePath(frameNumber)
            );

            finishRequest(false);
        };

        preloadImage.src =
            getFramePath(frameNumber);

        preloadedImages.push(
            preloadImage
        );
    });
}

async function preloadWorker() {
    while (
        nextFrameToLoad <=
        SETTINGS.totalFrames
    ) {
        const frameNumber =
            nextFrameToLoad;

        nextFrameToLoad++;

        await loadSingleFrame(
            frameNumber
        );
    }
}

async function preloadAllFrames() {
    const workers = [];

    const workerCount =
        Math.min(
            SETTINGS.preloadConcurrency,
            SETTINGS.totalFrames
        );

    for (
        let worker = 0;
        worker < workerCount;
        worker++
    ) {
        workers.push(
            preloadWorker()
        );
    }

    await Promise.all(workers);

    finishLoading();
}

/*
Global failsafe: the loading window can never remain
onscreen forever.
*/

window.setTimeout(() => {
    finishLoading();
}, SETTINGS.maximumLoadingTime);

/* ======================================================
   AUTOPLAY
====================================================== */

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

/* ======================================================
   INSTRUCTION WINDOW
====================================================== */

function hideDragInstruction() {
    if (dragInstruction) {
        dragInstruction.classList.add(
            "is-hidden"
        );
    }
}

function closeInstructionWindow() {
    if (
        !dragInstruction ||
        dragInstruction.classList.contains(
            "is-closed"
        )
    ) {
        return;
    }

    dragInstruction.classList.add(
        "is-closing"
    );

    window.setTimeout(() => {

        dragInstruction.classList.remove(
            "is-closing"
        );

        dragInstruction.classList.add(
            "is-closed"
        );

    }, 220);
}

if (closeInstructionButton) {

    closeInstructionButton.addEventListener(
        "pointerdown",
        (event) => {
            event.stopPropagation();
        }
    );

    closeInstructionButton.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            closeInstructionWindow();
        }
    );
}

/* ======================================================
   CHARACTER WINDOW MINIMIZE / RESTORE
====================================================== */

function minimizeCharacterFile() {
    if (
        !characterFileWindow ||
        characterFileWindow.classList.contains(
            "is-minimized"
        )
    ) {
        return;
    }

    characterFileWindow.classList.add(
        "is-minimizing"
    );

    characterFileWindow.setAttribute(
        "aria-hidden",
        "true"
    );

    if (characterFileButton) {
        characterFileButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    window.setTimeout(() => {

        characterFileWindow.classList.remove(
            "is-minimizing"
        );

        characterFileWindow.classList.add(
            "is-minimized"
        );

        if (characterFileButton) {
            characterFileButton.classList.remove(
                "is-hidden"
            );
        }

    }, 220);
}

function restoreCharacterFile() {
    if (
        !characterFileWindow ||
        !characterFileWindow.classList.contains(
            "is-minimized"
        )
    ) {
        return;
    }

    if (characterFileButton) {
        characterFileButton.classList.add(
            "is-hidden"
        );

        characterFileButton.setAttribute(
            "aria-expanded",
            "true"
        );
    }

    characterFileWindow.classList.remove(
        "is-minimized"
    );

    characterFileWindow.classList.add(
        "is-restoring"
    );

    characterFileWindow.setAttribute(
        "aria-hidden",
        "false"
    );

    window.setTimeout(() => {

        characterFileWindow.classList.remove(
            "is-restoring"
        );

    }, 280);
}

if (minimizeCharacterButton) {

    minimizeCharacterButton.addEventListener(
        "pointerdown",
        (event) => {
            event.stopPropagation();
        }
    );

    minimizeCharacterButton.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            minimizeCharacterFile();
        }
    );
}

if (characterFileButton) {

    characterFileButton.addEventListener(
        "pointerdown",
        (event) => {
            event.stopPropagation();
        }
    );

    characterFileButton.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            restoreCharacterFile();
        }
    );
}

/* ======================================================
   DESKTOP MOUSE ROTATION
====================================================== */

viewer.addEventListener(
    "pointerdown",
    (event) => {

        if (
            !isReady ||
            event.pointerType !== "mouse"
        ) {
            return;
        }

        if (
            event.target.closest(
                ".xp-window"
            ) ||
            event.target.closest(
                "button"
            )
        ) {
            return;
        }

        isDragging = true;

        previousPointerX =
            event.clientX;

        previousPointerTime =
            performance.now();

        inertiaVelocity = 0;

        pauseAutoplay();
        hideDragInstruction();

        viewer.classList.add(
            "is-dragging"
        );

        viewer.setPointerCapture(
            event.pointerId
        );
    }
);

viewer.addEventListener(
    "pointermove",
    (event) => {

        if (
            event.pointerType !== "mouse" ||
            !isDragging ||
            !isReady
        ) {
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

    viewer.classList.remove(
        "is-dragging"
    );

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

/* ======================================================
   MOBILE ROTATION BUTTONS
====================================================== */

function stopMobileHold() {
    if (mobileHoldTimer !== null) {

        window.clearInterval(
            mobileHoldTimer
        );

        mobileHoldTimer = null;
    }

    if (rotateLeftButton) {
        rotateLeftButton.classList.remove(
            "is-pressed"
        );
    }

    if (rotateRightButton) {
        rotateRightButton.classList.remove(
            "is-pressed"
        );
    }
}

function startMobileHold(
    button,
    frameAmount
) {
    if (!isReady) {
        return;
    }

    stopMobileHold();

    button.classList.add(
        "is-pressed"
    );

    rotateByFrames(frameAmount);

    mobileHoldTimer =
        window.setInterval(() => {

            rotateByFrames(
                frameAmount
            );

        }, SETTINGS.mobileHoldInterval);
}

if (rotateLeftButton) {

    rotateLeftButton.addEventListener(
        "pointerdown",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            startMobileHold(
                rotateLeftButton,
                -SETTINGS.mobileButtonFrameStep
            );
        }
    );
}

if (rotateRightButton) {

    rotateRightButton.addEventListener(
        "pointerdown",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            startMobileHold(
                rotateRightButton,
                SETTINGS.mobileButtonFrameStep
            );
        }
    );
}

[
    rotateLeftButton,
    rotateRightButton
]
    .filter(Boolean)
    .forEach((button) => {

        button.addEventListener(
            "pointerup",
            stopMobileHold
        );

        button.addEventListener(
            "pointercancel",
            stopMobileHold
        );

        button.addEventListener(
            "lostpointercapture",
            stopMobileHold
        );
    });

window.addEventListener(
    "pointerup",
    stopMobileHold
);

/* ======================================================
   KEYBOARD ROTATION
====================================================== */

window.addEventListener(
    "keydown",
    (event) => {

        if (!isReady) {
            return;
        }

        if (event.key === "ArrowLeft") {
            rotateByFrames(-1);
        }

        if (event.key === "ArrowRight") {
            rotateByFrames(1);
        }
    }
);

/* ======================================================
   ANIMATION LOOP
====================================================== */

function animationLoop(timestamp) {
    const elapsedMilliseconds =
        Math.min(
            timestamp -
            lastAnimationTime,
            50
        );

    lastAnimationTime = timestamp;

    if (
        isReady &&
        !isDragging
    ) {

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

/* ======================================================
   START DIGI PIXIE OS
====================================================== */

updateLoadingDisplay();
preloadAllFrames();

window.requestAnimationFrame(
    animationLoop
);
