var NUM_ASTEROIDS = 10;
var asteroids = [];
var renderer = null;

var ratio = 1;
var perfnow = function() { return Date.now(); };
if (window.performance && window.performance.now) {
  perfnow = function() { return performance.now(); };
} else if (window.performance && window.performance.webkitNow) {
  perfnow = function() { return performance.webkitNow(); };
}
if (!window.requestAnimationFrame) {
  if (window.webkitRequestAnimationFrame) {
    requestAnimationFrame = webkitRequestAnimationFrame;
  } else if (window.mozRequestAnimationFrame) {
    requestAnimationFrame = mozRequestAnimationFrame;
  } else if (window.msRequestAnimationFrame) {
    requestAnimationFrame = msRequestAnimationFrame;
  } else {
    requestAnimationFrame = function(callback) {
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
    this.cx.lineWidth = this.ratio / (size * 2);
    this.cx.translate(x, y);
    this.cx.rotate(angle);
    this.cx.scale(size, size);
    this.cx.beginPath();
    this.cx.moveTo(points[0], points[1]);
    for (var i = 2; i < points.length; i += 2) {
      this.cx.lineTo(points[i], points[i+1]);
    }
    this.cx.closePath();
    this.cx.stroke();
    this.cx.restore();
  }
};

function WebGLRenderer(canvas) {
  var gl = canvas.getContext("experimental-webgl");
  var mat = mat3.create();
  var projectionMatrix = mat3.create();

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
    gl.viewport(0, 0, canvas.width, canvas.height);
    projectionMatrix = create2DProjection(canvas.width, canvas.height);
  };

  this.clear = function() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  this.drawPoly = function(x, y, angle, size, points) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);

    mat3.identity(mat);
    mat3.mul(mat, mat, projectionMatrix);
    mat3.translate(mat, mat, [x, y]);
    mat3.scale(mat, mat, [size, size]);
    mat3.rotate(mat, mat, angle);

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix3fv(matrixLocation, false, mat);
    gl.drawArrays(gl.LINE_LOOP, 0, points.length / 2);
  };
}

function makePoints() {
  var count = 15;
  var points = new Float32Array(count * 2);
  for (var i = 0; i < count; i++) {
    var angle = i * 2 * Math.PI / count;
    var radius = Math.random() * (1.0 - 0.5) + 0.5;
    points[2 * i] = radius * Math.cos(angle);
    points[2 * i + 1] = radius * Math.sin(angle);
  }
  return points;
}

function asteroid(startx, starty) {
  netobject.call(this, {x: netprop.f32, y: netprop.f32,
                        angle: netprop.f32,
                        // Would be nice if we had < 8 bit ints...
                        size: netprop.u8,
                        dx: netprop.i8, dy: netprop.i8,
                        dr: netprop.f32,
                        points: netprop.array(netprop.f32)
                       });
  this.points = makePoints();
  this.x = startx;
  this.y = starty;
  this.angle = 0;
  this.size = randInt(10, 50);
  // Velocity in units per second
  this.dx = randInt(-20, 20);
  this.dy = randInt(-20, 20);
  // Rotation in radians per second
  this.dr = randInt(-500, 500) * 2 * Math.PI / (365 * this.size);

  function draw(self, renderer, x, y) {
    renderer.drawPoly(x, y, self.angle, self.size, self.points);
  }

  this.draw = function(renderer, maxx, maxy) {
    draw(this, renderer, this.x, this.y);
    if (this.x - this.size < 0) {
      draw(this, renderer, maxx + this.x, this.y);
    } else if (this.x + this.size > maxx) {
      draw(this, renderer, this.x - maxx, this.y);
    }
    if (this.y - this.size < 0) {
      draw(this, renderer, this.x, maxy + this.y);
    } else if (this.y + this.size > maxy) {
      draw(this, renderer, this.x, this.y - maxy);
    }
  };

  this.run = function(elapsed, maxx, maxy) {
    //TODO: fix netgame.js to deal with typed arrays
    if (!(this.points instanceof Float32Array)) {
      this.points = new Float32Array(this.points);
    }
    this.x += elapsed * this.dx;
    if (this.x > maxx) {
      this.x -= maxx;
    } else if (this.x < 0) {
      this.x += maxx;
    }
    this.y += elapsed * this.dy;
    if (this.y > maxy) {
      this.y -= maxy;
    } else if (this.y < 0) {
      this.y += maxy;
    }
    this.angle += elapsed * this.dr;
  };
}
asteroid.prototype = netobject.register(asteroid);

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

function haveWebGL(c) {
  return c.getContext("experimental-webgl") != null;
}

function setup() {
  var c = document.getElementById("c");
  renderer = (window.location.search.indexOf("renderer=canvas2d") != -1 || !haveWebGL(c)) ?
    new Canvas2DRenderer(c) :
    new WebGLRenderer(c);
  resizeCanvas();
  addEventListener("mozfullscreenchange", resizeCanvas);
  addEventListener("webkitfullscreenchange", resizeCanvas);
  for (var i=0; i<NUM_ASTEROIDS; i++) {
    asteroids.push(new asteroid(randInt(0, c.width), randInt(0, c.height)));
  }
  requestAnimationFrame(draw);
}
