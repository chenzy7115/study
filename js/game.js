/* ============================================================
   逻辑层：SnakeGame
   纯数据与状态机，不依赖 DOM / Canvas，方便单测与复用。
   ============================================================ */
(function (global) {
  'use strict';

  /** 四个方向向量 */
  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  /** 游戏状态枚举 */
  var STATE = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    OVER: 'over'
  };

  /** 结束原因枚举 */
  var REASON = {
    WALL: 'wall',
    SELF: 'self',
    WIN: 'win'
  };

  var DEFAULTS = {
    cols: 20,
    rows: 20,
    initialLength: 3,
    baseInterval: 150,   // 初始每步耗时（毫秒），越小越快
    minInterval: 68,     // 速度上限
    speedStep: 4,        // 每吃一个食物减少的间隔
    scorePerFood: 10
  };

  /**
   * @constructor
   * @param {object} [options] 覆盖 DEFAULTS 的配置
   */
  function SnakeGame(options) {
    var opts = options || {};
    for (var key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        this[key] = typeof opts[key] === 'number' ? opts[key] : DEFAULTS[key];
      }
    }

    this._listeners = {};
    this.reset();
  }

  SnakeGame.STATE = STATE;
  SnakeGame.REASON = REASON;
  SnakeGame.DIRS = DIRS;

  /* ---------- 极简事件总线 ---------- */

  /**
   * 订阅事件，返回取消订阅函数
   * @param {string} type
   * @param {Function} handler
   * @returns {Function}
   */
  SnakeGame.prototype.on = function (type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
    var list = this._listeners[type];
    return function off() {
      var i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    };
  };

  SnakeGame.prototype.emit = function (type, payload) {
    var list = this._listeners[type];
    if (!list) return;
    for (var i = 0; i < list.length; i++) list[i](payload);
  };

  /* ---------- 生命周期 ---------- */

  /** 重置为初始状态（不自动开始） */
  SnakeGame.prototype.reset = function () {
    var cx = Math.floor(this.cols / 2);
    var cy = Math.floor(this.rows / 2);
    var len = Math.min(this.initialLength, this.cols - 2);

    this.snake = [];
    for (var i = 0; i < len; i++) {
      this.snake.push({ x: cx - i, y: cy });
    }
    // 上一帧的蛇身位置，用于渲染插值
    this.prevSnake = this.cloneSnake(this.snake);

    this.direction = DIRS.right;
    this.directionQueue = [];
    this.score = 0;
    this.foodEaten = 0;
    this.interval = this.baseInterval;
    this.progress = 0;          // 当前步的完成度 [0,1)，渲染插值用
    this.elapsed = 0;           // 累计运行时长（毫秒）
    this.food = this.spawnFood();
    this.deathReason = null;
    this._setState(STATE.IDLE, { silent: true });
    this.emit('reset', null);
    this.emit('score', this.getScoreInfo());
    return this;
  };

  /** 开始新一局 */
  SnakeGame.prototype.start = function () {
    if (this.state === STATE.OVER) this.reset();
    if (this.state === STATE.RUNNING) return this;
    this._setState(STATE.RUNNING);
    return this;
  };

  /** 暂停 */
  SnakeGame.prototype.pause = function () {
    if (this.state === STATE.RUNNING) this._setState(STATE.PAUSED);
    return this;
  };

  /** 继续 */
  SnakeGame.prototype.resume = function () {
    if (this.state === STATE.PAUSED) this._setState(STATE.RUNNING);
    return this;
  };

  /** 在 运行/暂停 之间切换 */
  SnakeGame.prototype.togglePause = function () {
    if (this.state === STATE.RUNNING) this.pause();
    else if (this.state === STATE.PAUSED) this.resume();
    else this.start();
    return this;
  };

  /** 立即结束本局 */
  SnakeGame.prototype.gameOver = function (reason) {
    if (this.state === STATE.OVER) return this;
    this.deathReason = reason || REASON.WALL;
    this.progress = 0;
    this._setState(STATE.OVER);
    this.emit('gameover', {
      reason: this.deathReason,
      score: this.score,
      length: this.snake.length,
      elapsed: this.elapsed
    });
    return this;
  };

  /* ---------- 主循环驱动 ---------- */

  /**
   * 由渲染循环每帧调用
   * @param {number} dt 距上一帧的毫秒数
   */
  SnakeGame.prototype.update = function (dt) {
    if (this.state !== STATE.RUNNING) return;
    if (!(dt > 0)) return;
    // 标签页切回时 dt 可能极大，限制单帧跨度避免瞬移式连撞
    if (dt > 250) dt = 250;

    this.elapsed += dt;
    this.progress += dt / this.interval;

    var guard = 0;
    while (this.progress >= 1 && this.state === STATE.RUNNING && guard++ < 4) {
      this.progress -= 1;
      this.step();
    }
    if (this.state !== STATE.RUNNING) this.progress = 0;
  };

  /** 推进一格 */
  SnakeGame.prototype.step = function () {
    this._applyQueuedDirection();

    var dir = this.direction;
    var head = { x: this.snake[0].x + dir.x, y: this.snake[0].y + dir.y };

    // 撞墙判定
    if (head.x < 0 || head.y < 0 || head.x >= this.cols || head.y >= this.rows) {
      this.gameOver(REASON.WALL);
      return;
    }

    var willEat = head.x === this.food.x && head.y === this.food.y;
    // 不吃食物时尾巴会腾出位置，因此最后一节不算障碍
    var obstacleCount = willEat ? this.snake.length : this.snake.length - 1;
    for (var i = 0; i < obstacleCount; i++) {
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        this.gameOver(REASON.SELF);
        return;
      }
    }

    this.prevSnake = this.cloneSnake(this.snake);
    this.snake.unshift(head);

    if (willEat) {
      this.score += this.scorePerFood;
      this.foodEaten++;
      this.interval = Math.max(this.minInterval, this.baseInterval - this.foodEaten * this.speedStep);
      this.emit('eat', {
        x: head.x,
        y: head.y,
        score: this.score,
        foodEaten: this.foodEaten,
        interval: this.interval
      });
      this.emit('score', this.getScoreInfo());

      if (this.snake.length >= this.cols * this.rows) {
        this.gameOver(REASON.WIN);
        return;
      }
      this.food = this.spawnFood();
    } else {
      this.snake.pop();
    }

    this.emit('step', { direction: dir });
  };

  /* ---------- 方向控制 ---------- */

  /**
   * 请求转向。反向输入会被忽略；允许最多缓存 2 次输入以支持快速连转。
   * @param {string} name up | down | left | right
   * @returns {boolean} 是否被接受
   */
  SnakeGame.prototype.setDirection = function (name) {
    var dir = DIRS[name];
    if (!dir || this.state === STATE.OVER) return false;

    // 与队尾方向（无则该当前方向）比较，禁止 180° 掉头
    var last = this.directionQueue.length
      ? this.directionQueue[this.directionQueue.length - 1]
      : this.direction;
    if (dir.x === -last.x && dir.y === -last.y) return false;
    // 重复方向不入队
    if (dir.x === last.x && dir.y === last.y) return false;

    if (this.directionQueue.length >= 2) this.directionQueue.shift();
    this.directionQueue.push(dir);
    return true;
  };

  SnakeGame.prototype._applyQueuedDirection = function () {
    while (this.directionQueue.length) {
      var next = this.directionQueue.shift();
      if (next.x === this.direction.x && next.y === this.direction.y) continue;
      if (next.x === -this.direction.x && next.y === -this.direction.y) continue;
      this.direction = next;
      return;
    }
  };

  /* ---------- 工具方法 ---------- */

  /** 在空闲格中随机生成食物 */
  SnakeGame.prototype.spawnFood = function () {
    var occupied = {};
    for (var i = 0; i < this.snake.length; i++) {
      occupied[this.snake[i].x + ',' + this.snake[i].y] = true;
    }

    var free = [];
    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        if (!occupied[x + ',' + y]) free.push({ x: x, y: y });
      }
    }
    if (!free.length) return { x: -1, y: -1 };
    return free[Math.floor(Math.random() * free.length)];
  };

  SnakeGame.prototype.cloneSnake = function (snake) {
    var out = new Array(snake.length);
    for (var i = 0; i < snake.length; i++) out[i] = { x: snake[i].x, y: snake[i].y };
    return out;
  };

  SnakeGame.prototype.getScoreInfo = function () {
    return {
      score: this.score,
      length: this.snake.length,
      foodEaten: this.foodEaten,
      speedLevel: Math.floor((this.baseInterval - this.interval) / this.speedStep) + 1
    };
  };

  SnakeGame.prototype._setState = function (next, opts) {
    if (this.state === next) return;
    var prev = this.state;
    this.state = next;
    if (!opts || !opts.silent) this.emit('statechange', { state: next, previous: prev });
  };

  global.SnakeGame = SnakeGame;
})(window);