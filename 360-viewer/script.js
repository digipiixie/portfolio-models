"use strict";

/*
==========================================================
MODEL SETTINGS
==========================================================
*/

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

    mobileButtonFrameStep: 8,
    mobileHoldInterval: 70,

    /*
    Limits how many image downloads happen simultaneously.
    This is much safer inside a Carrd iframe.
    */
    preloadConcurrency: 8,

    /*
    If one image request hangs, stop waiting after this time.
    */
    frameLoadTimeout: 15000
};


/*
==========================================================
PAGE ELEMENTS
==========================================================
*/

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

const characterFileWindow =
    document.getElementById("characterFileWindow");

const characterFileButton =
    document.getElementById("characterFileButton");

const rotateLeftButton =
    document.getElementById("rotateLeftButton");

const rotateRightButton =
    document.getElementById("rotateRightButton");


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

let lastAnimationTime =
    performance.now();

let loadedFrameCount = 0;
let failedFrameCount = 0;
let completedFrameCount = 0;

let nextFrameToLoad = 1;
let mobileHoldTimer = null;

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
    const frameCount =
        SETTINGS.totalFrames;

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


function rotateByFrames(amount) {
    pauseAutoplay();

    inertiaVelocity = 0;

    framePosition =
        wrapFramePosition(
            framePosition + amount
        );

    showFrame(framePosition);

    scheduleAutoplayResume();
}


/*
==========================================================
LOADING DISPLAY
==========================================================
*/

function updateLoadingDisplay() {
    const percentage =
        Math.round(
            (
                completedFrameCount /
                SETTINGS.totalFrames
            ) * 100
        );

    loadingProgress.style.width =
        `${percentage}%`;

    loadingPercentage.textContent =
        `${percentage}%`;

    if (!loadingStatus) {
        return;
    }

    if (percentage < 25) {
        loadingStatus.textContent =
            "Reading Character.FBX...";
    } else if (percentage < 50) {
        loadingStatus.textContent =
            "Loading materials...";
    } else if (percentage < 75) {
        loadingStatus.textContent =
            "Preparing viewport...";
    } else if (percentage < 100) {
        loadingStatus.textContent =
            "Almost ready...";
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
    loadingScreen.classList.add("is-hidden");

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


/*
==========================================================
CONTROLLED FRAME PRELOADING
==========================================================
*/

function loadSingleFrame(frameNumber) {
    return new Promise((resolve) => {
        const preloadImage =
            new Image();

        let requestFinished = false;

        const timeoutId =
            window.setTimeout(() => {
                if (requestFinished) {
                    return;
                }

                requestFinished = true;
                failedFrameCount++;

                console.warn(
                    "Frame timed out:",
                    getFramePath(frameNumber)
                );

                resolve();
            }, SETTINGS.frameLoadTimeout);

        preloadImage.onload = () => {
            if (requestFinished) {
                return;
            }

            requestFinished = true;

            window.clearTimeout(timeoutId);

            loadedFrameCount++;
            resolve();
        };

        preloadImage.onerror = () => {
            if (requestFinished) {
                return;
            }

            requestFinished = true;

            window.clearTimeout(timeoutId);

            failedFrameCount++;

            console.error(
                "Could not load frame:",
                getFramePath(frameNumber)
            );

            resolve();
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

        completedFrameCount++;
        updateLoadingDisplay();
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

    /*
    Even if one or two frames fail, do not leave the
    visitor trapped behind the loading window.
    */
    finishLoading();
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
    if (dragInstruction) {
        dragInstruction.classList.add(
            "is-hidden"
        );
    }
}


/*
==========================================================
GENERAL CLOSE BUTTON
==========================================================
*/

function closeWindow(windowElement) {
    if (
        !windowElement ||
        windowElement.classList.contains(
            "is-closing"
        ) ||
        windowElement.classList.contains(
            "is-closed"
        )
    ) {
        return;
    }

    windowElement.classList.add(
        "is-closing"
    );

    window.setTimeout(() => {
        windowElement.classList.remove(
            "is-closing"
        );

        windowElement.classList.add(
            "is-closed"
        );
    }, 200);
}


document
    .querySelectorAll("[data-close-window]")
    .forEach((button) => {

        button.addEventListener(
            "pointerdown",
            (event) => {
                event.stopPropagation();
            }
        );

        button.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                const targetId =
                    button.getAttribute(
                        "data-close-window"
                    );

                const targetWindow =
                    document.getElementById(
                        targetId
                    );

                closeWindow(targetWindow);
            }
        );
    });


/*
==========================================================
CHARACTER FILE MINIMIZE / RESTORE
==========================================================
*/

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

    characterFileButton.setAttribute(
        "aria-expanded",
        "false"
    );

    window.setTimeout(() => {
        characterFileWindow.classList.remove(
            "is-minimizing"
        );

        characterFileWindow.classList.add(
            "is-minimized"
        );

        characterFileButton.classList.remove(
            "is-hidden"
        );
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

    characterFileButton.classList.add(
        "is-hidden"
    );

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

    characterFileButton.setAttribute(
        "aria-expanded",
        "true"
    );

    window.setTimeout(() => {
        characterFileWindow.classList.remove(
            "is-restoring"
        );
    }, 260);
}


document
    .querySelectorAll("[data-minimize-window]")
    .forEach((button) => {

        button.addEventListener(
            "pointerdown",
            (event) => {
                event.stopPropagation();
            }
        );

        button.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                const targetId =
                    button.getAttribute(
                        "data-minimize-window"
                    );

                if (
                    targetId ===
                    "characterFileWindow"
                ) {
                    minimizeCharacterFile();
                }
            }
        );
    });


characterFileButton.addEventListener(
    "click",
    (event) => {
        event.preventDefault();
        event.stopPropagation();

        restoreCharacterFile();
    }
);


/*
==========================================================
DESKTOP MOUSE ROTATION
==========================================================
*/

viewer.addEventListener(
    "pointerdown",
    (event) => {
        if (!isReady) {
            return;
        }

        /*
        Mobile uses the buttons instead, allowing the
        parent Carrd page to scroll vertically.
        */
        if (event.pointerType !== "mouse") {
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


/*
==========================================================
MOBILE ROTATION BUTTONS
==========================================================
*/

function stopMobileHold() {
    if (mobileHoldTimer !== null) {
        window.clearInterval(
            mobileHoldTimer
        );

        mobileHoldTimer = null;
    }

    rotateLeftButton.classList.remove(
        "is-pressed"
    );

    rotateRightButton.classList.remove(
        "is-pressed"
    );
}


function startMobileHold(
    button,
    frameAmount
) {
    stopMobileHold();

    button.classList.add(
        "is-pressed"
    );

    rotateByFrames(frameAmount);

    mobileHoldTimer =
        window.setInterval(() => {
            rotateByFrames(frameAmount);
        }, SETTINGS.mobileHoldInterval);
}


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


[
    rotateLeftButton,
    rotateRightButton
].forEach((button) => {

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
            rotateByFrames(-1);
        }

        if (event.key === "ArrowRight") {
            rotateByFrames(1);
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
