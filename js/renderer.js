/* ============================================================
   渲染层：CanvasRenderer
   只负责把 SnakeGame 的状态画到 Canvas 上，不修改任何游戏数据。
   支持基于 progress 的位置插值，使格子化逻辑也能呈现顺滑移动。
   ============================================================ */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * @constructor
   * @param {HTMLCanvasElement} canvas
   * @param {SnakeGame} game
   */
  function CanvasRenderer(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.ctx = canvas.getContext('2d');

    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.cell = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.effects = [];
    this.maxEffects = 24;

    this.resize();
  }

  /* ---------- 尺寸 ---------- */

  /** 根据 CSS 尺寸（含 DPR）重设画布分辨率与格子大小 */
  CanvasRenderer.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var pixelW = Math.round(rect.width * dpr);
    var pixelH = Math.round(rect.height * dpr);

    if (this.canvas.width !== pixelW || this.canvas.height !== pixelH) {
      this.canvas.width = pixelW;
      this.canvas.height = pixelH;
    }

    this.dpr = dpr;
    this.width = rect.width;
    this.height = rect.height;
    this.cell = Math.min(rect.width / this.game.cols, rect.height / this.game.rows);
    this.offsetX = (rect.width - this.cell * this.game.cols) / 2;
    this.offsetY = (rect.height - this.cell * this.game.rows) / 2;
  };

  /** 格子坐标 → 画布中心点（CSS 像素） */
  CanvasRenderer.prototype.cellCenter = function (x, y) {
    return {
      x: this.offsetX + (x + 0.5) * this.cell,
      y: this.offsetY + (y + 0.5) * this.cell
    };
  };

  /* ---------- 特效 ---------- */

  /** 吃到食物时的扩散光环 */
  CanvasRenderer.prototype.addEatEffect = function (cellX, cellY) {
    this._pushEffect({ type: 'ring', x: cellX, y: cellY, start: this._now() });
  };

  /** 结束时的红色闪屏 */
  CanvasRenderer.prototype.addDeathFlash = function () {
    this._pushEffect({ type: 'flash', start: this._now() });
  };

  CanvasRenderer.prototype._pushEffect = function (effect) {
    this.effects.push(effect);
    if (this.effects.length > this.maxEffects) this.effects.shift();
  };

  CanvasRenderer.prototype._now = function () {
    return global.performance && global.performance.now ? global.performance.now() : Date.now();
  };

  /* ---------- 主绘制 ---------- */

  /**
   * @param {number} now performance.now() 时间戳
   */
  CanvasRenderer.prototype.render = function (now) {
    var ctx = this.ctx;
    var game = this.game;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this._drawBackground(now);

    var t = this._getInterpolation();
    var points = this._interpolatedPoints(t);

    this._drawFood(now);
    this._drawSnake(points);
    this._drawEffects(now);
  };

  /** 计算渲染插值系数 */
  CanvasRenderer.prototype._getInterpolation = function () {
    var game = this.game;
    if (game.state === SnakeGame.STATE.RUNNING) return clamp(game.progress, 0, 1);
    if (game.state === SnakeGame.STATE.OVER) return 1;
    return clamp(game.progress, 0, 1);
  };

  /** 把逻辑格点插值成连续像素坐标 */
  CanvasRenderer.prototype._interpolatedPoints = function (t) {
    var game = this.game;
    var snake = game.snake;
    var prev = game.prevSnake;
    var cell = this.cell;
    var pts = new Array(snake.length);

    for (var i = 0; i < snake.length; i++) {
      var cur = snake[i];
      var p = prev[i] || prev[prev.length - 1] || cur;
      pts[i] = {
        x: this.offsetX + (lerp(p.x, cur.x, t) + 0.5) * cell,
        y: this.offsetY + (lerp(p.y, cur.y, t) + 0.5) * cell
      };
    }
    return pts;
  };

  /* ---------- 背景 ---------- */

  CanvasRenderer.prototype._drawBackground = function (now) {
    var ctx = this.ctx;
    var game = this.game;
    var cell = this.cell;

    // 棋盘底纹
    ctx.fillStyle = 'rgba(255, 255, 255, 0.016)';
    for (var y = 0; y < game.rows; y++) {
      for (var x = (y % 2); x < game.cols; x += 2) {
        ctx.fillRect(this.offsetX + x * cell, this.offsetY + y * cell, cell, cell);
      }
    }

    // 网格线
    ctx.strokeStyle = 'rgba(140, 200, 190, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx <= game.cols; gx++) {
      var px = Math.round(this.offsetX + gx * cell) + 0.5;
      ctx.moveTo(px, this.offsetY);
      ctx.lineTo(px, this.offsetY + game.rows * cell);
    }
    for (var gy = 0; gy <= game.rows; gy++) {
      var py = Math.round(this.offsetY + gy * cell) + 0.5;
      ctx.moveTo(this.offsetX, py);
      ctx.lineTo(this.offsetX + game.cols * cell, py);
    }
    ctx.stroke();

    // 运行中：呼吸式内边框；危险时（蛇很长）转为暖色
    var pulse = 0.5 + 0.5 * Math.sin(now / 700);
    var t = clamp(game.snake.length / (game.cols * game.rows * 0.5), 0, 1);
    var r = Math.round(lerp(61, 255, t));
    var g = Math.round(lerp(220, 170, t));
    var b = Math.round(lerp(132, 87, t));
    ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.1 + 0.16 * pulse * (0.4 + t)) + ')';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.offsetX + 1,
      this.offsetY + 1,
      game.cols * cell - 2,
      game.rows * cell - 2
    );
  };

  /* ---------- 食物 ---------- */

  CanvasRenderer.prototype._drawFood = function (now) {
    var game = this.game;
    if (!game.food || game.food.x < 0) return;

    var ctx = this.ctx;
    var cell = this.cell;
    var c = this.cellCenter(game.food.x, game.food.y);
    var pulse = 0.5 + 0.5 * Math.sin(now / 260);
    var radius = cell * (0.29 + 0.035 * pulse);

    ctx.save();

    // 外光晕
    ctx.globalAlpha = 0.5 + 0.3 * pulse;
    ctx.shadowColor = 'rgba(255, 93, 108, 0.95)';
    ctx.shadowBlur = cell * (0.7 + 0.35 * pulse);
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, TAU);
    ctx.fillStyle = 'rgba(255, 93, 108, 0.55)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    // 果实本体
    var grad = ctx.createRadialGradient(
      c.x - radius * 0.35, c.y - radius * 0.4, radius * 0.15,
      c.x, c.y, radius
    );
    grad.addColorStop(0, '#ffd98a');
    grad.addColorStop(0.45, '#ff8a5c');
    grad.addColorStop(1, '#e8354f');
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, TAU);
    ctx.fillStyle = grad;
    ctx.fill();

    // 高光
    ctx.beginPath();
    ctx.arc(c.x - radius * 0.32, c.y - radius * 0.36, radius * 0.24, 0, TAU);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fill();

    // 叶子
    ctx.beginPath();
    ctx.ellipse(
      c.x + radius * 0.34, c.y - radius * 0.86,
      radius * 0.46, radius * 0.24, -0.7, 0, TAU
    );
    ctx.fillStyle = 'rgba(122, 226, 130, 0.95)';
    ctx.fill();
    ctx.restore();
  };

  /* ---------- 蛇 ---------- */

  CanvasRenderer.prototype._drawSnake = function (points) {
    if (!points.length) return;

    var ctx = this.ctx;
    var cell = this.cell;
    var n = points.length;
    var dying = this.game.state === SnakeGame.STATE.OVER;

    // 1) 外发光（整条路径一次描边）
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = dying ? 'rgba(255, 93, 108, 0.8)' : 'rgba(61, 220, 132, 0.75)';
    ctx.shadowBlur = cell * 0.85;
    ctx.strokeStyle = dying ? 'rgba(255, 120, 130, 0.55)' : 'rgba(61, 220, 132, 0.5)';
    ctx.lineWidth = cell * 0.7;
    this._tracePath(points);
    ctx.stroke();
    ctx.restore();

    // 2) 分段渐变本体（从尾部画到头部，保证头部在上层）
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = n - 1; i >= 1; i--) {
      var u = n > 1 ? i / (n - 1) : 0;      // 0 = 头部，1 = 尾部
      ctx.strokeStyle = this._bodyColor(u, dying);
      ctx.lineWidth = cell * (0.82 - 0.2 * u);
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i - 1].x, points[i - 1].y);
      ctx.stroke();
    }
    ctx.restore();

    // 3) 头部
    this._drawHead(points[0], dying);
  };

  CanvasRenderer.prototype._tracePath = function (points) {
    var ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  };

  /** 沿蛇身方向的颜色插值：头部亮绿 → 尾部深绿 */
  CanvasRenderer.prototype._bodyColor = function (u, dying) {
    if (dying) {
      return 'hsl(' + Math.round(lerp(6, 348, u)) + ', ' + Math.round(lerp(88, 62, u)) + '%, ' + Math.round(lerp(66, 34, u)) + '%)';
    }
    var h = Math.round(lerp(99, 155, u));
    var s = Math.round(lerp(100, 78, u));
    var l = Math.round(lerp(72, 33, u));
    return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
  };

  CanvasRenderer.prototype._drawHead = function (head, dying) {
    var ctx = this.ctx;
    var cell = this.cell;
    var radius = cell * 0.44;
    var dir = this.game.direction;

    ctx.save();
    ctx.beginPath();
    ctx.arc(head.x, head.y, radius, 0, TAU);
    ctx.fillStyle = dying ? 'hsl(6, 88%, 64%)' : 'hsl(99, 100%, 72%)';
    ctx.shadowColor = dying ? 'rgba(255, 93, 108, 0.9)' : 'rgba(176, 255, 150, 0.9)';
    ctx.shadowBlur = cell * 0.6;
    ctx.fill();
    ctx.restore();

    // 眼睛：沿运动方向前移，垂直于运动方向分开
    var px = -dir.y;
    var py = dir.x;
    var forward = radius * 0.34;
    var side = radius * 0.42;
    var eyeR = Math.max(1.4, radius * 0.24);
    var pupilR = Math.max(0.8, eyeR * 0.55);

    for (var s = -1; s <= 1; s += 2) {
      var ex = head.x + dir.x * forward + px * side * s;
      var ey = head.y + dir.y * forward + py * side * s;

      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, TAU);
      ctx.fillStyle = '#f4fffa';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ex + dir.x * eyeR * 0.28, ey + dir.y * eyeR * 0.28, pupilR, 0, TAU);
      ctx.fillStyle = '#0b1a12';
      ctx.fill();
    }
  };

  /* ---------- 特效绘制 ---------- */

  CanvasRenderer.prototype._drawEffects = function (now) {
    var ctx = this.ctx;
    var cell = this.cell;

    for (var i = this.effects.length - 1; i >= 0; i--) {
      var fx = this.effects[i];
      var age = now - fx.start;

      if (fx.type === 'ring') {
        var life = 460;
        if (age > life) { this.effects.splice(i, 1); continue; }
        var p = age / life;
        var c = this.cellCenter(fx.x, fx.y);
        ctx.beginPath();
        ctx.arc(c.x, c.y, cell * (0.3 + p * 0.85), 0, TAU);
        ctx.strokeStyle = 'rgba(255, 190, 120, ' + (1 - p) * 0.85 + ')';
        ctx.lineWidth = cell * 0.16 * (1 - p) + 1;
        ctx.stroke();
      } else if (fx.type === 'flash') {
        var flife = 520;
        if (age > flife) { this.effects.splice(i, 1); continue; }
        var fp = age / flife;
        var grd = ctx.createRadialGradient(
          this.offsetX + this.game.cols * cell / 2,
          this.offsetY + this.game.rows * cell / 2,
          cell * 1.5,
          this.offsetX + this.game.cols * cell / 2,
          this.offsetY + this.game.rows * cell / 2,
          Math.max(this.width, this.height) * 0.75
        );
        grd.addColorStop(0, 'rgba(255, 60, 80, 0)');
        grd.addColorStop(1, 'rgba(255, 60, 80, ' + (1 - fp) * 0.5 + ')');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, this.width, this.height);
      }
    }
  };

  global.CanvasRenderer = CanvasRenderer;
})(window);