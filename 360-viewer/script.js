const image = document.getElementById("model");


const totalFrames = 144;

let currentFrame = 1;

let dragging = false;

let previousX = 0;



function updateImage(){

    let frame =
    String(currentFrame).padStart(4,"0");


    image.src =
    `frames/360-model-spin${frame}.webp`;

}



image.addEventListener("pointerdown", function(event){

    dragging = true;

    previousX = event.clientX;

});



window.addEventListener("pointermove", function(event){

    if(!dragging) return;


    let movement =
    event.clientX - previousX;



    if(Math.abs(movement) > 5){


        if(movement > 0){

            currentFrame--;

        } else {

            currentFrame++;

        }



        if(currentFrame < 1){

            currentFrame = totalFrames;

        }


        if(currentFrame > totalFrames){

            currentFrame = 1;

        }


        updateImage();


        previousX = event.clientX;

    }

});



window.addEventListener("pointerup", function(){

    dragging = false;

});
