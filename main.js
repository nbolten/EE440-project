/////////////////
// Load images //
/////////////////

var imageLoader = document.getElementById('imageLoader');
    imageLoader.addEventListener('change', handleImage, false);

var originalCanvas = document.getElementById('originalCanvas');
var originalCtx = originalCanvas.getContext('2d');

var canvas = document.getElementById('modifiedCanvas');
var ctx = canvas.getContext('2d');

function loadImage(image) {
  // Resize the image to fit nicely in the div (and increase filter speed!)
  canvasDivWidtho = $('#original-canvas-container').width();
  if (image.width > canvas.width) {
    originalCanvas.width = canvasDivWidtho;
    originalCanvas.height = originalCanvas.width * image.height / image.width;
  } else {
    originalCanvas.width = image.width;
    originalCanvas.height = image.height;
  }
  originalCtx.drawImage(image, 0, 0, originalCanvas.width, originalCanvas.height);
  window.srcPixels = new Uint8ClampedArray(originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height).data);

  canvasDivWidthm = $('#modified-canvas-container').width();
  if (image.width > canvas.width) {
    canvas.width = canvasDivWidthm;
    canvas.height = canvas.width * image.height / image.width;
  } else {
    canvas.width = image.width;
    canvas.height = image.height;
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  window.srcPixels = new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
}

default_img = new Image();
default_img.src = './coffee.png';
default_img.onload = function() {
  loadImage(default_img);
};

function handleImage(e){
    var reader = new FileReader();
    reader.onload = function(event){
        var img = new Image();
        img.onload = function(){
            loadImage(img);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
}

///////////
// Reset //
///////////

$('#resetButton').click(function() {
  imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData.data.set(window.srcPixels);
  ctx.putImageData(imageData, 0, 0);
});

//////////////////////////////////
// Global canvas image accessor //
//////////////////////////////////

function getImageData() {
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/////////////
// Buttons //
/////////////

$('#grayScaleButton').click(function() {
  var img = new IPImage(getImageData());
  img.grayscale()
    .setImageData(ctx);
});

$('#gaussianBlurButton').click(function() {
  var img = new IPImage(getImageData());
  img.gaussian(1, 1)
    .setImageData(ctx);
});

$('#highboostButton').click(function() {
  var img = new IPImage(getImageData());
  img.highboost()
    .setImageData(ctx);
});

$('#sobelButton').click(function() {
  var img = new IPImage(getImageData());
  img.sobel()
    .setImageData(ctx);
});

////////////////
// Effects UI //
////////////////

// TODO: make less redundant
// Abstraction Effect
$('#abstractionSize').mousemove(function() {
  $('#abstractionSizeOutput').text(this.value);
});
$('#abstractionSigmaR').mousemove(function() {
  $('#abstractionSigmaROutput').text(this.value);
});
$('#abstractionSigmaG').mousemove(function() {
  $('#abstractionSigmaGOutput').text(this.value);
});
$('#abstractionPasses').mousemove(function() {
  $('#abstractionPassesOutput').text(this.value);
});

$('#abstractionButton').click(function() {
  // Get slide settings
  var size = $('#abstractionSize').val();
  var sigmaR = $('#abstractionSigmaR').val();
  var sigmaG = $('#abstractionSigmaG').val();
  var passes = parseInt($('#abstractionPasses').val());

  var img = new IPImage(getImageData());
  for (var i = 0; i < passes; i++) {
    img.bilateral(size, sigmaG, sigmaR);
  }
  img.setImageData(ctx);
});

// Cartoon effect
$('#cartoonOutline').mousemove(function() {
  $('#cartoonOutlineOutput').text(this.value);
});
$('#cartoonSmooth').mousemove(function() {
  $('#cartoonSmoothOutput').text(this.value);
});
$('#cartoonQuant').mousemove(function() {
  $('#cartoonQuantOutput').text(this.value);
});

$('#cartoonButton').click(function() {
  var outline = $('#cartoonOutline').val();
  var quantization = $('#cartoonQuant').val();
  var smoothness = $('#cartoonSmooth').val();
  // Generate an outline by doing gaussian + laplacian + gaussian
  var img = new IPImage(getImageData());

  img.gaussian()
    .gaussian();

  for (var i = 0; i < smoothness; i++) {
    img.bilateral(2, 10, 2);
  }

  var outlines = img.copy()
                   .laplacian(outline)
                   .intensity()
                   .gaussian();

  img.quantize(quantization)
    .subtract(outlines, 0.7)
    .setImageData(ctx);
});

// Illustration effect
$('#illustrationDetail').mousemove(function() {
  $('#illustrationDetailOutput').text(this.value);
});
$('#illustrationCutoff').mousemove(function() {
  $('#illustrationCutoffOutput').text(this.value);
});

$('#illustrationButton').click(function() {
  var img = new IPImage(getImageData());
  var detail = $('#illustrationDetail').val();
  var cutoff = $('#illustrationCutoff').val();
  img.highboost(detail);
  var outline = img.copy()
                  .gaussian()
                  .sobel()
                  .intensity()
                  .histogramEqualize()
                  .intensityCutoff(cutoff);

  img.subtract(outline, 1)
    .setImageData(ctx);
});
