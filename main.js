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

//////////////////////////////
// Generic kernel functions //
//////////////////////////////

Kernels = {};

Kernels.gaussianFunc = function(x, sigma) {
  return (1.0 / (2 * Math.PI * Math.pow(sigma, 2))) * Math.exp(-x / (2 * Math.pow(sigma, 2)));
};

Kernels.normalize = function(kernel) {
  // Normalize a kernel so it sums to 1
  var newkernel = new Float32Array(kernel.length);

  var weightsum = kernel.reduce(function(a, b) { return a + b; }, 0);
  for (i = 0; i < kernel.length; i++) {
    newkernel[i] = kernel[i] / weightsum;
  }
  return newkernel;
};

Kernels.gaussian = function(sigma, size) {
  sigma = size || 1;
  size = size || 1;
  // Will generate a gaussian-looking kernel for a given variance
  dim = size * 2 + 1;
  center = size;
  var kernel2D = [];
  for (y = 0; y < dim; y++) {
    kernel2D[y] = [];
    for (x = 0; x < dim; x++) {
      distance = Math.sqrt(Math.pow(y - center, 2) + Math.pow(x - center, 2));
      kernel2D[y][x] = this.gaussianFunc(distance, sigma);
    }
  }
  // Flatten
  var kernel = kernel2D.reduce(function(a, b) { return a.concat(b); });
  // Normalize (so it sums to 1)
  kernel = this.normalize(kernel);
  return kernel;
};

Kernels.laplacian = function(size) {
  var dim = size * 2 + 1;
  var kernel = Array(dim * dim);
  kernel.fill(1);
  kernel[Math.floor(kernel.length / 2)] = -(kernel.length - 1);
  return kernel;
};

Kernels.highboost = function(c) {
  var kernel =  [-c,        -c, -c,
                 -c, 8 * c + 1, -c,
                 -c,        -c, -c];

  return this.normalize(kernel);
};

Kernels.sobelY = [-1, -2, -1,
                   0,  0,  0,
                   1,  2,  1];

Kernels.sobelX = [-1, 0, 1,
                  -2, 0, 2,
                  -1, 0, 1];


////////////////////////////////////////////////////
// Extend ImageData to enable chaining of filters //
////////////////////////////////////////////////////

function IPImage(img) {
  this.img = img;
}

IPImage.prototype = {
  copy: function() {
    // Create a copy of the current object
    // Make a new image
    var img = new ImageData(this.img.width, this.img.height);
    // Copy the data into the image
    var data = new Uint8ClampedArray(this.img.data);
    img.data.set(data);
    var copy = new IPImage(img);
    return copy;
  },

  setImageData: function(context) {
    context.putImageData(this.img, 0, 0);
  },

  //////////////////////////
  // Single Pixel Filters //
  //////////////////////////

  subtract: function(other, amount) {
    amount = amount || 1;

    var d = this.img.data;
    var o = other.img.data;

    for (var i = 0; i < d.length; i += 4) {
      d[i] = d[i] - amount * o[i];
      d[i + 1] = d[i + 1] - amount * o[i + 1];
      d[i + 2] = d[i + 2] - amount * o[i + 2];
    }
    return this;
  },

  grayscale: function() {
    var d = this.img.data;
    for (var i = 0; i < d.length; i += 4) {
      r = d[i];
      g = d[i + 1];
      b = d[i + 2];

      v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return this;
  },

  invert: function() {
    var d = this.img.data;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    return this;
  },

  // Color quantization
  quantize: function(bits) {
    bits = bits || 4;
    var d = this.img.data;
    var factor = Math.pow(2, bits) / Math.pow(2, 8);
    for (var i = 0; i < d.length; i += 4) {
      d[i] = Math.floor(d[i] * factor) / factor;
      d[i + 1] = Math.floor(d[i + 1] * factor) / factor;
      d[i + 2] = Math.floor(d[i + 2] * factor) / factor;
    }
    return this;
  },

  intensity: function() {
    var d = this.img.data;
    for (var i = 0; i < d.length; i += 4) {
      intensity = (d[i] + d[i + 1] + d[i + 2]) / 3.0;
      d[i] = d[i + 1] = d[i + 2] = intensity;
    }
    return this;
  },

  intensityCutoff: function(cutoff) {
    cutoff = cutoff || 128;
    var d = this.img.data;

    for (var i = 0; i < d.length; i += 4) {
      var intensity = (d[i] + d[i + 1] + d[i + 2]) / 3.0;
      if (intensity < cutoff) {
        d[i] = d[i + 1] = d[i + 2] = 0;
      }
    }

    return this;
  },

  matchIntensity: function(other) {
    var d = this.img.data;
    var o = other.img.data;

    // FIXME: this isn't perfect? Double check by converting to HSI then back
    // again
    for (var i = 0; i < d.length; i += 4) {
      scaleI = o[i] / ((d[i] + d[i + 1] + d[i + 2]) / 3.0);
      d[i] = d[i] * scaleI;
      d[i + 1] = d[i + 1] * scaleI;
      d[i + 2] = d[i + 2] * scaleI;
    }

    return this;
  },

  // Borrowed from stackoveflow
  histogramEqualize: function() {
    var d = this.img.data;

    // Compute histogram and histogram sum:
    var hist = new Float32Array(256);
    var sum = 0;
    for (var i = 0; i < d.length; ++i) {
        ++hist[~~d[i]];
        ++sum;
    }

    // Compute integral histogram:
    var prev = hist[0];
    for (var i = 1; i < 256; ++i) {
        prev = hist[i] += prev;
    }

    // Equalize image:
    var norm = 255 / sum;
    for (var i = 0; i < d.length; ++i) {
        d[i] = hist[~~d[i]] * norm;
    }

    return this;
  },

  ///////////////////////////////////
  // Linear convolution operations //
  ///////////////////////////////////

  convolve: function(kernel) {
    var d = this.img.data;
    // TODO: remove redundancy of boilerplate copying of data
    var out = new Uint8ClampedArray(d.length);
    var w = this.img.width;
    var h = this.img.height;

    var dim = Math.round(Math.sqrt(kernel.length));
    var center = Math.floor(dim / 2);

    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var r = 0;
        var g = 0;
        var b = 0;
        var a = 0;

        for (var cy = 0; cy < dim; cy++) {
          for (var cx = 0; cx < dim; cx++) {
            // input array is 1D, but we need to reat it as 2D
            // What would the 2-D coordinates be? If either are <0,
            // don't apply weight to that pixel.
            var y2d = y + cy - center;
            var x2d = x + cx - center;
            if (y2d >= 0 && y2d < h && x2d >= 0 && x2d < w) {
              var offset = (y2d * w + x2d) * 4;
              var weight = kernel[cy * dim + cx];
              r += d[offset] * weight;
              g += d[offset + 1] * weight;
              b += d[offset + 2] * weight;
              a += d[offset + 3] * weight;
            }
          }
        }

        var centerIndex = (y * w + x) * 4;
        out[centerIndex] = r;
        out[centerIndex + 1] = g;
        out[centerIndex + 2] = b;
        out[centerIndex + 3] = a + (255 - a);
      }
    }

    // Copy data into d (is there a better way to do this?)
    // Why doesn't this work? this.img.data = out;
    // TODO: make this less redundant
    for (var i = 0; i < d.length; i++) {
      d[i] = out[i];
    }

    return this;
  },

  gaussian: function(sigma, size) {
    sigma = sigma || 1;
    size = size || 1;
    var kernel = Kernels.gaussian(sigma, size);
    return this.convolve(kernel);
  },

  laplacian: function(size) {
    size = size || 2;
    var kernel = Kernels.laplacian(size);
    return this.convolve(kernel);
  },

  highboost: function(c) {
    c = c || 2;
    var kernel = Kernels.highboost(c);
    return this.convolve(kernel);
  },

  sobel: function() {
    var d = this.img.data;

    var sy = this.copy().convolve(Kernels.sobelY).img.data;
    var sx = this.copy().convolve(Kernels.sobelX).img.data;

    function geometricMean(a, b) {
      return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));
    }

    for (var i = 0; i < d.length; i += 4) {
      // return geometric mean of horizontal- and vertical-filtered images
      d[i] = geometricMean(sy[i], sx[i]);
      d[i + 1] = geometricMean(sy[i + 1], sx[i + 1]);
      d[i + 2] = geometricMean(sy[i + 2], sx[i + 2]);
    }

    return this;
  },

  ///////////////////////
  // Nonlinear filters //
  ///////////////////////

  bilateral: function(size, sigmaG, sigmaR) {
    size = size || 2;
    // These defaults make a 'cartoonish' effect
    sigmaG = sigmaG || 10;
    sigmaR = sigmaR || 2;

    var d = this.img.data;
    var out = new Uint8ClampedArray(d.length);
    var w = this.img.width;
    var h = this.img.height;

    var dim = size * 2 + 1;
    var center = Math.floor(dim / 2);

    // Precompute the Gaussian
    var spacialKernel = Kernels.gaussian(sigmaG, size);

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var cIndex = (y * w + x) * 4;
        var cI = (d[cIndex] + d[cIndex + 1] + d[cIndex + 2]) / 3.0 ;

        // Calculate the kernel for this region (must compute now due to need
        // to normalize the weights to sum to 1).
        // Just need to know the intensities vector in the neighborhood
        var kernel = [];
        for (var cy_ = 0; cy_ < dim; cy_++) {
          for (var cx_ = 0; cx_ < dim; cx_++) {
            var y2d_ = y + cy_ - center;
            var x2d_ = x + cx_ - center;
            var range_weight;
            if (y2d_ >= 0 && y2d_ < h && x2d_ >= 0 && x2d_ < w) {
              // Calculate the Gaussian of the intensity
              var offset_ = (y2d_ * w + x2d_) * 4;
              var intensity = (d[offset_] + d[offset_ + 1] + d[offset_ + 2]) / 3.0 ;
              var range = Math.abs(cI - intensity);
              range_weight = Kernels.gaussianFunc(range, sigmaR);
            } else {
              // We're outside the image (set to 0, why not)
              range_weight = 0;
            }
            // Now combine with the spatial Gaussian
            var spatial = spacialKernel[cy_ * dim + cx_];
            kernel.push(spatial * range_weight);
          }
        }
        // Finally, normalize so weights sum to 1.
        kernel = Kernels.normalize(kernel);

        // FIXME: these can be applied with the same loop - just save the
        // total weights and divide at the end

        // Now apply the kernel
        var r,
            g,
            b,
            a;
        r = g = b = a = 0;
        for (var cy = 0; cy < dim; cy++) {
          for (var cx = 0; cx < dim; cx++) {
            // input array is 1D, but we need to reat it as 2D
            // What would the 2-D coordinates be? If either are <0,
            // don't apply weight to that pixel.
            var y2d = y + cy - center;
            var x2d = x + cx - center;
            if (y2d >= 0 && y2d < h && x2d >= 0 && x2d < w) {
              var offset = (y2d * w + x2d) * 4;
              var weight = kernel[cy * dim + cx];
              r += d[offset] * weight;
              g += d[offset + 1] * weight;
              b += d[offset + 2] * weight;
              a += d[offset + 3] * weight;
            }
          }
        }

        out[cIndex] = r;
        out[cIndex + 1] = g;
        out[cIndex + 2] = b;
        out[cIndex + 3] = a;
      }
    }
    // Copy data into d (is there a better way to do this?)
    // Why doesn't this work? this.img.data = out;
    // TODO: make this less redundant
    for (var i = 0; i < d.length; i++) {
      d[i] = out[i];
    }

    return this;
  },

  median: function(size) {
    size = size | 1;

    var d = this.img.data;
    var out = new Uint8ClampedArray(d.length);

    var w = this.img.width;
    var h = this.img.height;
    var dim = size * 2 + 1;
    var center = Math.floor(dim / 2);

    function median(arr) {
      arr.sort(function(a, b) { return a - b; });
      var half = Math.floor(arr.length / 2.0);

      if (arr.length % 2) {
        return arr[half];
      } else {
        return (arr[half - 1] + arr[half]) / 2.0;
      }
    }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var centerIndex = (y * w + x) * 4;

        var rs = [];
        var bs = [];
        var gs = [];
        var as = [];
        for (var cy = 0; cy < dim; cy++) {
          for (var cx = 0; cx < dim; cx++) {
            // input array is 1D, but we need to reat it as 2D
            // What would the 2-D coordinates be? If either are <0,
            // don't apply weight to that pixel.
            var y2d = y + cy - center;
            var x2d = x + cx - center;
            if (y2d >= 0 && y2d < h && x2d >= 0 && x2d < w) {
              var offset = (y2d * w + x2d) * 4;
              rs.push(d[offset]);
              gs.push(d[offset + 1]);
              bs.push(d[offset + 2]);
              as.push(d[offset + 3]);
            }
          }
        }
        // Sort and find the median
        out[centerIndex] = median(rs);
        out[centerIndex + 1] = median(gs);
        out[centerIndex + 2] = median(bs);
        out[centerIndex + 3] = median(as);
      }
    }
    // Copy data into d (is there a better way to do this?)
    // Why doesn't this work? this.img.data = out;
    // TODO: make this less redundant
    for (var i = 0; i < d.length; i++) {
      d[i] = out[i];
    }

    return this;
  }
};


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
