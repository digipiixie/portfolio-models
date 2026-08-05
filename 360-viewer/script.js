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

    /*
    Finger movement required before the viewer decides
    whether the gesture is horizontal or vertical.
    */
    touchDirectionThreshold: 10
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

/*
Touch gestures begin in a waiting state.

The script waits to see whether the visitor moves
mostly horizontally or vertically.
*/
let gesturePending = false;
let gestureIsHorizontal = false;

let pointerStartX = 0;
let pointerStartY = 0;

let previousPointerX = 0;
let previousPointerTime = 0;

let activePointerId = null;

let inertiaVelocity = 0;

let autoplayEnabled = false;
let autoplayResumeTimer = null;

let lastAnimationTime =
    performance.now();

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


/*
==========================================================
LOADING
==========================================================
*/

function updateLoadingDisplay() {
    const completedFrames =
        loadedFrameCount +
        failedFrameCount;

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


function preloadAllFrames() {
    for (
        let frameNumber = 1;
        frameNumber <= SETTINGS.totalFrames;
        frameNumber++
    ) {
        const preloadImage =
            new Image();

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

        preloadedImages.push(
            preloadImage
        );
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
    if (dragInstruction) {
        dragInstruction.classList.add(
            "is-hidden"
        );
    }
}


/*
==========================================================
WINDOW CONTROLS
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
    }, 180);
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

                const target =
                    document.getElementById(
                        button.dataset.closeWindow
                    );

                closeWindow(target);
            }
        );
    });


/*
==========================================================
START HORIZONTAL ROTATION
==========================================================
*/

function beginRotation(event) {
    isDragging = true;
    gesturePending = false;
    gestureIsHorizontal = true;

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

    /*
    Pointer capture begins only after we know the visitor
    intends to rotate rather than scroll vertically.
    */
    if (
        !viewer.hasPointerCapture(
            event.pointerId
        )
    ) {
        viewer.setPointerCapture(
            event.pointerId
        );
    }
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

        /*
        Clicking an XP window should not rotate the model.
        */
        if (
            event.target.closest(
                ".xp-window"
            )
        ) {
            return;
        }

        activePointerId =
            event.pointerId;

        pointerStartX =
            event.clientX;

        pointerStartY =
            event.clientY;

        previousPointerX =
            event.clientX;

        previousPointerTime =
            performance.now();

        inertiaVelocity = 0;

        /*
        Mouse users begin dragging immediately.

        Touch and pen users first get direction detection,
        allowing vertical Carrd scrolling.
        */
        if (event.pointerType === "mouse") {
            beginRotation(event);
        } else {
            gesturePending = true;
            gestureIsHorizontal = false;
        }
    }
);


viewer.addEventListener(
    "pointermove",
    (event) => {
        if (
            event.pointerId !==
            activePointerId
        ) {
            return;
        }

        /*
        Decide whether a touch gesture is intended for
        page scrolling or character rotation.
        */
        if (
            gesturePending &&
            !isDragging
        ) {
            const totalMovementX =
                event.clientX -
                pointerStartX;

            const totalMovementY =
                event.clientY -
                pointerStartY;

            const absoluteX =
                Math.abs(totalMovementX);

            const absoluteY =
                Math.abs(totalMovementY);

            const largestMovement =
                Math.max(
                    absoluteX,
                    absoluteY
                );

            if (
                largestMovement <
                SETTINGS.touchDirectionThreshold
            ) {
                return;
            }

            /*
            Vertical gesture:
            cancel viewer interaction and let Carrd scroll.
            */
            if (absoluteY > absoluteX) {
                gesturePending = false;
                gestureIsHorizontal = false;
                activePointerId = null;

                return;
            }

            /*
            Horizontal gesture:
            begin rotating the character.
            */
            gestureIsHorizontal = true;
            beginRotation(event);
        }

        if (
            !isDragging ||
            !isReady ||
            !gestureIsHorizontal
        ) {
            return;
        }

        /*
        Stop horizontal dragging from moving the page.
        */
        event.preventDefault();

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
    gesturePending = false;
    gestureIsHorizontal = false;

    activePointerId = null;

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
