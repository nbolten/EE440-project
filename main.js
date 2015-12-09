var imageLoader = document.getElementById('imageLoader');
    imageLoader.addEventListener('change', handleImage, false);
var canvas = document.getElementById('imageCanvas');
var ctx = canvas.getContext('2d');

window.onload = function() {
  default_img = new Image();
  default_img.src = './coffee.png';
  default_img.onload = function() {
    canvas.width = default_img.width;
    canvas.height = default_img.height;
    ctx.drawImage(default_img, 0, 0);
  };
};

function handleImage(e){
    var reader = new FileReader();
    reader.onload = function(event){
        var img = new Image();
        img.onload = function(){
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}
