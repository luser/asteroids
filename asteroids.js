var NUM_ASTEROIDS = 10;
var asteroids = [];

var ratio = 1;
var perfnow = function() { return Date.now(); };
if ('performance' in window) {
  perfnow = function() { return performance.now(); };
}
if (!('requestAnimationFrame' in window)) {
  if ('webkitRequestAnimationFrame' in window) {
    requestAnimationFrame = webkitRequestAnimationFrame;
  } else if ('mozRequestAnimationFrame' in window) {
    requestAnimationFrame = mozRequestAnimationFrame;
  } else if ('msRequestAnimationFrame' in window) {
    requestAnimationFrame = msRequestAnimationFrame;
  } else {
    requestAnimationFrame  = function(callback) {
      setTimeout(callback, 16.666);
    };
  }
}

var last = perfnow();

function makePoints() {
  var points = [];
  var count = 15;
  for (var i = 0; i < count; i++) {
    var angle = i * 2 * Math.PI / count;
    var radius = Math.random() * (1.0 - 0.5) + 0.5;
    points.push([angle, radius]);
  }
  return points;
}

function p2r(p) {
  return [p[1] * Math.cos(p[0]), p[1] * Math.sin(p[0])];
}

function asteroid(startx, starty) {
  var points = makePoints();
  var x = startx, y = starty, r = 0;
  var size = randInt(10, 50);
  var dx = randInt(-20, 20);
  var dy = randInt(-20, 20);
  var dr = randInt(-500, 500) * 2 * Math.PI / (365 * size);

  function draw(cx, x, y) {
    cx.save();
    cx.strokeStyle = "white";
    cx.lineWidth = ratio / size;
    cx.translate(x, y);
    cx.rotate(r);
    cx.scale(size, size);
    cx.beginPath();
    var p = p2r(points[0]);
    cx.moveTo(p[0], p[1]);
    for (var i = 1; i < points.length; i++) {
      p = p2r(points[i]);
      cx.lineTo(p[0], p[1]);
    }
    cx.closePath();
    cx.stroke();
    cx.restore();
  }

  this.draw = function(cx, maxx, maxy) {
    draw(cx, x, y);
    if (x - size < 0) {
      draw(cx, maxx + x, y);
    } else if (x + size > maxx) {
      draw(cx, x - maxx, y);
    }
    if (y - size < 0) {
      draw(cx, x, maxy + y);
    } else if (y + size > maxy) {
      draw(cx, x, y - maxy);
    }
  };

  this.run = function(elapsed, maxx, maxy) {
    x += elapsed * dx;
    if (x > maxx) {
      x -= maxx;
    } else if (x < 0) {
      x += maxx;
    }
    y += elapsed * dy;
    if (y > maxy) {
      y -= maxy;
    } else if (y < 0) {
      y += maxy;
    }
    r += elapsed * dr;
  };
}

function draw() {
  var c = document.getElementById("c");
  var cx = c.getContext("2d");
  cx.fillStyle = "black";
  cx.fillRect(0, 0, cx.width, cx.height);

  var now = perfnow();
  var elapsed = (now - last) / 1000;
  for (var i=0; i < asteroids.length; i++) {
    asteroids[i].run(elapsed, c.width, c.height);
    asteroids[i].draw(cx, c.width, c.height);
  }
  last = now;
  requestAnimationFrame(draw);
}

function resizeCanvas() {
  var c = document.getElementById("c");
  var cx = c.getContext("2d");
  var width = window.innerWidth;
  var height = window.innerHeight;
  var devRatio = window.devicePixelRatio || 1;
  var backingRatio = cx.webkitBackingStorePixelRatio || 1;
  if (devRatio != backingRatio) {
    ratio = devRatio / backingRatio;
    c.style.width = width + "px";
    c.style.height = height + "px";
    width *= ratio;
    height *= ratio;
    cx.scale(ratio, ratio);
  }
  c.width = width;
  c.height = height;
  cx.width = width;
  cx.height = height;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fullscreen(thing) {
  (thing.requestFullScreen || thing.mozRequestFullScreen ||
  thing.webkitRequestFullScreen || function(x) {}).call(thing);
}

function setup() {
  resizeCanvas();
  var c = document.getElementById("c");
  addEventListener("mozfullscreenchange", resizeCanvas);
  addEventListener("webkitfullscreenchange", resizeCanvas);
  for (var i=0; i<NUM_ASTEROIDS; i++) {
    asteroids.push(new asteroid(randInt(0, c.width), randInt(0, c.height)));
  }
  requestAnimationFrame(draw);
}