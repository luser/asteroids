var NUM_ASTEROIDS = 10;
var asteroids = [];
var renderer = null;

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

function Canvas2DRenderer(canvas) {
  this.canvas = canvas;
  this.cx = canvas.getContext("2d");
  this.ratio = 1;
}

Canvas2DRenderer.prototype = {
  resize: function() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var devRatio = window.devicePixelRatio || 1;
    var backingRatio = this.cx.webkitBackingStorePixelRatio || 1;
    if (devRatio != backingRatio) {
      this.ratio = devRatio / backingRatio;
      this.canvas.style.width = width + "px";
      this.canvas.style.height = height + "px";
      width *= this.ratio;
      height *= this.ratio;
      this.cx.scale(this.ratio, this.ratio);
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.cx.width = width;
    this.cx.height = height;
  },

  clear: function() {
    this.cx.fillStyle = "black";
    this.cx.fillRect(0, 0, this.cx.width, this.cx.height);
  },

  drawPoly: function(x, y, angle, size, points) {
    this.cx.save();
    this.cx.strokeStyle = "white";
    this.cx.lineWidth = this.ratio / size;
    this.cx.translate(x, y);
    this.cx.rotate(angle);
    this.cx.scale(size, size);
    this.cx.beginPath();
    var p = points[0];
    this.cx.moveTo(p[0], p[1]);
    for (var i = 1; i < points.length; i++) {
      p = points[i];
      this.cx.lineTo(p[0], p[1]);
    }
    this.cx.closePath();
    this.cx.stroke();
    this.cx.restore();
  }
};

function WebGLRenderer(canvas) {
  var gl = canvas.getContext("experimental-webgl");
  var mat = mat3.create();
  var projectionMatrix;

  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, "attribute vec2 a_position; \
uniform mat3 u_matrix; \
void main() { \
   gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1); \
} \
");
  gl.compileShader(vertexShader);
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, "void main() { \
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);  \
} \
");
  gl.compileShader(fragmentShader);
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);

  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return;
  }

  gl.useProgram(program);
  var positionLocation = gl.getAttribLocation(program, "a_position");
  var matrixLocation = gl.getUniformLocation(program, "u_matrix");

  var buffer = gl.createBuffer();

  function create2DProjection(width, height) {
    return mat3.copy(mat3.create(),
                     [2 / width, 0, 0,
                      0, -2 / height, 0,
                      -1, 1, 1]);
  }

  this.resize = function() {
    var ratio = window.devicePixelRatio || 1;
    var width = window.innerWidth;
    var height = window.innerHeight;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    projectionMatrix = create2DProjection(canvas.width, canvas.height);
  };

  this.clear = function() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  this.drawPoly = function(x, y, angle, size, points) {
    var arr = new Float32Array(points.length * 2);
    for (var i = 0; i < points.length; i++) {
      arr.set(points[i], i*2);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);

    mat3.identity(mat);
    mat3.mul(mat, mat, projectionMatrix);
    mat3.translate(mat, mat, [x, y]);
    mat3.scale(mat, mat, [size, size]);
    mat3.rotate(mat, mat, angle);

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix3fv(matrixLocation, false, mat);
    gl.drawArrays(gl.LINE_LOOP, 0, points.length);
  };
}

function makePoints() {
  var points = [];
  var count = 15;
  for (var i = 0; i < count; i++) {
    var angle = i * 2 * Math.PI / count;
    var radius = Math.random() * (1.0 - 0.5) + 0.5;
    points.push(p2r(angle, radius));
  }
  return points;
}

function p2r(angle, radius) {
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function asteroid(startx, starty) {
  var points = makePoints();
  var x = startx, y = starty, r = 0;
  var size = randInt(10, 50);
  var dx = randInt(-20, 20);
  var dy = randInt(-20, 20);
  var dr = randInt(-500, 500) * 2 * Math.PI / (365 * size);

  function draw(renderer, x, y) {
    renderer.drawPoly(x, y, r, size, points);
  }

  this.draw = function(renderer, maxx, maxy) {
    draw(renderer, x, y);
    if (x - size < 0) {
      draw(renderer, maxx + x, y);
    } else if (x + size > maxx) {
      draw(renderer, x - maxx, y);
    }
    if (y - size < 0) {
      draw(renderer, x, maxy + y);
    } else if (y + size > maxy) {
      draw(renderer, x, y - maxy);
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
  var now = perfnow();
  var elapsed = (now - last) / 1000;
  renderer.clear();
  for (var i=0; i < asteroids.length; i++) {
    asteroids[i].run(elapsed, c.width, c.height);
    asteroids[i].draw(renderer, c.width, c.height);
  }
  last = now;
  requestAnimationFrame(draw);
}

function resizeCanvas() {
  renderer.resize();
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fullscreen(thing) {
  (thing.requestFullScreen || thing.mozRequestFullScreen ||
  thing.webkitRequestFullScreen || function(x) {}).call(thing);
}

function setup() {
  var c = document.getElementById("c");
  renderer =
    //new WebGLRenderer(c);
    new Canvas2DRenderer(c);
  resizeCanvas();
  addEventListener("mozfullscreenchange", resizeCanvas);
  addEventListener("webkitfullscreenchange", resizeCanvas);
  for (var i=0; i<NUM_ASTEROIDS; i++) {
    asteroids.push(new asteroid(randInt(0, c.width), randInt(0, c.height)));
  }
  requestAnimationFrame(draw);
}
