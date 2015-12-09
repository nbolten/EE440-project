/////////////////
// Load images //
/////////////////

var imageLoader = document.getElementById('imageLoader');
    imageLoader.addEventListener('change', handleImage, false);
var canvas = document.getElementById('imageCanvas');
var ctx = canvas.getContext('2d');

default_img = new Image();
default_img.src = './coffee.png';
default_img.onload = function() {
  canvas.width = default_img.width;
  canvas.height = default_img.height;
  ctx.drawImage(default_img, 0, 0);
  window.srcPixels = new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
};

function handleImage(e){
    var reader = new FileReader();
    reader.onload = function(event){
        var img = new Image();
        img.onload = function(){
            window.srcImage = img;
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            window.srcPixels = new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
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

///////////////////////
// Per-pixel filters //
///////////////////////

function filterImage(filterFunc) {
  imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels = imageData.data;
  filtered = filterFunc(pixels);
  imageData.data.set(filtered);
  ctx.putImageData(imageData, 0, 0);
}

function grayScale(pixels) {
  for (var i=0; i < pixels.length; i += 4) {
    r = pixels[i];
    g = pixels[i + 1];
    b = pixels[i + 2];

    v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    pixels[i] = v;
    pixels[i + 1] = v;
    pixels[i + 2] = v;
  }
  return pixels;
}

$('#grayScaleButton').click(function() {
  filterImage(grayScale);
});

////////////////////////////
// Convolution operations //
////////////////////////////

function convolve(pixels, weights) {
  // Scale the filter so the weights sum to 1
  weightsum = weights.reduce(function(pv, cv) { return pv + cv; }, 0);
  for (i = 0; i < weights.length; i++) {
    weights[i] = weights[i] / weightsum;
  }

  // It has to be a square filter (and odd dimensions)
  dim = Math.round(Math.sqrt(weights.length));
  center = Math.floor(dim / 2);
  for (y = 0; y < canvas.height; y++) {
    for (x = 0; x < canvas.width; x++) {
      r = 0;
      g = 0;
      b = 0;
      a = 0;

      for (cy = 0; cy < dim; cy++) {
        for (cx = 0; cx < dim; cx++) {
          // input array is 1D, but we need to reat it as 2D
          // What would the 2-D coordinates be? If either are <0,
          // don't apply weight to that pixel.
          y2d = y + cy - center;
          x2d = x + cx - center;
          if (y2d >= 0 && y2d < canvas.height && x2d >= 0 && x2d < canvas.width) {
            offset = (y2d * canvas.width + x2d) * 4;
            weight = weights[cy * dim + cx];
            r += pixels[offset] * weight;
            g += pixels[offset + 1] * weight;
            b += pixels[offset + 2] * weight;
            a += pixels[offset + 3] * weight;
          }
        }
      }

      centerIndex = (y * canvas.width + x) * 4;
      pixels[centerIndex] = r;
      pixels[centerIndex + 1] = g;
      pixels[centerIndex + 2] = b;
      pixels[centerIndex + 3] = a + (255 - a);
    }
  }

  return pixels;
}

function gaussian(x, sigma) {
  return (1.0 / (2 * Math.PI * Math.pow(sigma, 2))) * Math.exp(-x / (2 * Math.pow(sigma, 2)));
}

function gaussianKernel(size, sigma) {
  // Will generate a gaussian-looking kernel for a given variance
  dim = size * 2 + 1;
  center = size;
  kernel = [];
  for (y = 0; y < dim; y++) {
    kernel[y] = [];
    for (x = 0; x < dim; x++) {
      distance = Math.sqrt(Math.pow(y - center, 2) + Math.pow(x - center, 2));
      kernel[y][x] = gaussian(distance, sigma);
    }
  }
  // Flatten
  return kernel.reduce(function(a, b) { return a.concat(b); });
}

function gaussianBlur(pixels) {
  kernel = gaussianKernel(1, 1);
  convolved = convolve(pixels, kernel);
  return convolved;
}

$('#gaussianBlurButton').click(function() {
  filterImage(gaussianBlur);
});

//////////////////////
// Bilateral filter //
//////////////////////


function bilateralFilter(pixels) {
  // FIXME: these need to be arguments
  kernelSize = 2;
  dim = kernelSize * 2 + 1;
  sigmaG = 10;
  sigmaR = 10;

  // Output should be a different data structure, as iterating over the same
  // array that's being outputted will result in redundant convolutions.
  output = new Uint8ClampedArray(pixels.length);

  center = Math.floor(dim / 2);

  // Precompute the Gaussian
  myGaussianKernel = gaussianKernel(kernelSize, sigmaG);

  for (y = 0; y < canvas.height; y++) {
    for (x = 0; x < canvas.width; x++) {
      centerIndex = (y * canvas.width + x) * 4;
      centerI = (pixels[centerIndex] + pixels[centerIndex + 1] + pixels[centerIndex + 2]) / 3.0 ;

      // Calculate the range kernel (must compute now due to need
      // to normalize the weights to sum to 1).
      // Just need to know the intensities vector in the neighborhood
      weights = [];
      for (cy = 0; cy < dim; cy++) {
        for (cx = 0; cx < dim; cx++) {
          y2d = y + cy - center;
          x2d = x + cx - center;
          if (y2d >= 0 && y2d < canvas.height && x2d >= 0 && x2d < canvas.width) {
            // Get the intensity
            offset = (y2d * canvas.width + x2d) * 4;
            otherI = (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3.0 ;
            intensity_diff = Math.abs(centerI - otherI);
            weight_range = gaussian(intensity_diff, sigmaR);
          } else {
            // We're outside the image (set to 0, why not)
            weight_range = 0;
          }
          // Now combine with the Gaussian
          weight_gaussian = myGaussianKernel[cy * dim + cx];
          weights.push(weight_gaussian * weight_range);
        }
      }

      // Finally, normalize so weights sum to 0.
      weightsum = weights.reduce(function(a, b) { return a + b; }, 0);
      for (i = 0; i < weights.length; i++) {
        weights[i] = weights[i] / weightsum;
      }

      r = g = b = 0;
      for (cy = 0; cy < dim; cy++) {
        for (cx = 0; cx < dim; cx++) {
          // input array is 1D, but we need to reat it as 2D
          // What would the 2-D coordinates be? If either are <0,
          // don't apply weight to that pixel.
          y2d = y + cy - center;
          x2d = x + cx - center;
          if (y2d >= 0 && y2d < canvas.height && x2d >= 0 && x2d < canvas.width) {
            offset = (y2d * canvas.width + x2d) * 4;
            weight = weights[cy * dim + cx];
            r += pixels[offset] * weight;
            g += pixels[offset + 1] * weight;
            b += pixels[offset + 2] * weight;
          }
        }
      }

      output[centerIndex] = r;
      output[centerIndex + 1] = g;
      output[centerIndex + 2] = b;
      // No rgba support
      output[centerIndex + 3] = 255;
    }
  }

  return output;
}

$('#BilateralButton').click(function() {
  filterImage(bilateralFilter);
});
