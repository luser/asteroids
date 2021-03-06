var NUM_ASTEROIDS = 40;
// Arbitrary, but try to set larger than max expected client screen resolution.
//XXX: This doesn't actually work right in practice. Client wrapping + server wrapping
// means asteroids jump positions when they wrap server side.
var GAME_WIDTH = 4000;
var GAME_HEIGHT = 4000;
var things = [];
var renderer = null;
var server = null;
var client = null;

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

function wrapAround(self) {
    if (self.x > GAME_WIDTH) {
        self.x -= GAME_WIDTH;
    } else if (self.x < 0) {
        self.x += GAME_WIDTH;
    }
    if (self.y > GAME_HEIGHT) {
        self.y -= GAME_HEIGHT;
    } else if (self.y < 0) {
        self.y += GAME_HEIGHT;
    }
}

function asteroid(startx, starty) {
  netobject.call(this, {x: netprop.f32, y: netprop.f32,
                        angle: netprop.f32,
                        // Would be nice if we had < 8 bit ints...
                        radius: netprop.u8,
                        dx: netprop.i8, dy: netprop.i8,
                        dr: netprop.f32,
                        points: netprop.array(netprop.f32)
                       });
  this.points = makePoints();
  this.x = startx;
  this.y = starty;
  this.angle = 0;
  this.radius = randInt(10, 50);
  // Velocity in units per second
  this.dx = randInt(-20, 20);
  this.dy = randInt(-20, 20);
  // Rotation in radians per second
  this.dr = randInt(-500, 500) * 2 * Math.PI / (365 * this.radius);

  function draw(self, renderer, x, y) {
    renderer.drawPoly(x, y, self.angle, self.radius, self.points);
  }

  this.draw = function(renderer, cx, cy, w, h) {
    var x = this.x;
    var y = this.y;
    //TODO: handle wraparound
    draw(this, renderer, x - cx, y - cy);
      /*
    if (x - this.radius < 0) {
      draw(this, renderer, maxx + x, y);
    } else if (x + this.size > maxx) {
      draw(this, renderer, x - maxx, y);
    }
    if (y - this.radius < 0) {
      draw(this, renderer, x, maxy + y);
    } else if (y + this.radius > maxy) {
      draw(this, renderer, x, y - maxy);
    }
*/
  };

  this.run = function(elapsed) {
    //TODO: fix netgame.js to deal with typed arrays
    if (!(this.points instanceof Float32Array)) {
      this.points = new Float32Array(this.points);
    }
    this.x += elapsed * this.dx;
    this.y += elapsed * this.dy;
    wrapAround(this);
    this.angle += elapsed * this.dr;
  };
}
asteroid.prototype = netobject.register(asteroid);

function ship(startx, starty) {
  netobject.call(this, {x: netprop.f32, y: netprop.f32,
                        angle: netprop.f32,
                        thrust: netprop.u8});

  this.x = startx;
  this.y = starty;
  this.radius = 20;
  this.angle = 0;
  this.thrust = 0;
  this.rotation = 0;
  const MAX_SPEED = 400;
  var velocity = vec2.create();
  var currentVelocity = vec2.create();

  const points = new Float32Array([0, this.radius/2, this.radius/2, -this.radius/2, -this.radius/2, -this.radius/2]);
  const rocket_points = new Float32Array([3, -this.radius/2, 0, -18, -3, -this.radius/2]);
  this.draw = function(renderer, cx, cy, w, h) {
      renderer.drawPoly(this.x - cx, this.y - cy, this.angle, this.radius/10, points);
      if (this.thrust > 0) {
          renderer.drawPoly(this.x - cx, this.y - cy, this.angle, this.radius/10, rocket_points);
      }
  };

  this.run = function(elapsed) {
      this.angle += elapsed * this.rotation;
      this.x -= velocity[0] * elapsed;
      this.y += velocity[1] * elapsed;
      wrapAround(this);
  };

  this.applyInput = function(input) {
      this.rotation = input.rotate * 2 * Math.PI / 365; //X factor
      this.thrust = input.thrust;
      currentVelocity[0] = Math.sin(this.angle) * this.thrust/2;
      currentVelocity[1] = Math.cos(this.angle) * this.thrust/2;
      vec2.add(velocity, velocity, currentVelocity);
      var len = vec2.len(velocity);
      if (len > MAX_SPEED) {
          vec2.normalize(velocity, velocity);
          vec2.scale(velocity, velocity, MAX_SPEED);
      }
      //input.fire
  };
}
ship.prototype = netobject.register(ship);

function handleInput(input) {
    this.player.applyInput(input);
}

// Player input
function input() {
  netobject.call(this, {rotate: netprop.i8,
                        thrust: netprop.u8,
                        // Wish I had a 1-bit type!
                        fire: netprop.u8});

  this.copy = function(other) {
      this.rotate = other.rotate;
      this.thrust = other.thrust;
      this.fire = other.fire;
  };
}
input.prototype = netobject.register(input, clientinput);

function draw() {
  var c = document.getElementById("c");
  renderer.clear();
  var t = client.things;
  // Try to center the client.
  var cx = c.width/2;
  var cy = c.height/2;
  if (client && client.self) {
      cx = client.self.x - c.width/2;
      cy = client.self.y - c.height/2;
  }
  for (var i=0; i < t.length; i++) {
    t[i].draw(renderer, cx, cy, c.width, c.height);
  }

  requestAnimationFrame(draw);
}

var keys = new Set(["Up", "Left", "Right", " "]);
var lastInput = null;
function keyhandler(e) {
  if (!client) {
      return;
  }
  if (keys.has(e.key)) {
    var press = e.type == "keydown";
    var i = client.getNextInput();
    if (lastInput) {
        i.copy(lastInput);
    }
    if (e.key == "Left") {
      i.rotate = press ? -127 : 0;
    } else if (e.key == "Right") {
      i.rotate = press ? 127 : 0;
    } else if (e.key == "Up") {
      i.thrust = press ? 255 : 0;
    } else if (e.keyCode == " ") {
      i.fire = press ? 1 : 0;
    }
    lastInput = i;
    e.preventDefault();
  }
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

function runServerFrame() {
  var now = perfnow();
  var elapsed = (now - last) / 1000;
  for (var i=0; i < things.length; i++) {
    things[i].run(elapsed);
  }
  last = now;
}

function sendToClients() {
  server.updateClients(things);
}

function startServer() {
  var server_rate = 15;
  var transmit_rate = 50;
  server = new server_net();
  for (var i=0; i<NUM_ASTEROIDS; i++) {
    things.push(new asteroid(randInt(0, GAME_WIDTH), randInt(0, GAME_HEIGHT)));
  }
  setInterval(runServerFrame, server_rate);
  setInterval(sendToClients, transmit_rate);
}

function addLocalClient() {
  client = new client_net({send: function(data) { sc.recv(data); } }, input);
  var sc = new server_client({send: function(data) { client.recv(data); } });
  sc.oninput = handleInput;
  server.addClient(sc);
  var player = new ship(randInt(0, GAME_WIDTH), randInt(0, GAME_HEIGHT));
  things.push(player);
  sc.player = player;
  sc.clientThing = player;
  addEventListener("keydown", keyhandler);
  addEventListener("keyup", keyhandler);
  setInterval(function() {
    client.sendToServer();
  }, 50);
}

function setup() {
  var c = document.getElementById("c");
  renderer = (window.location.search.indexOf("renderer=canvas2d") != -1 || !haveWebGL(c)) ?
    new Canvas2DRenderer(c) :
    new WebGLRenderer(c);
  resizeCanvas();
  addEventListener("mozfullscreenchange", resizeCanvas);
  addEventListener("webkitfullscreenchange", resizeCanvas);
  if (true) {
    startServer();
    addLocalClient();
  }
  requestAnimationFrame(draw);
}
