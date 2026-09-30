/* ============================================================
   交互层：InputController
   把键盘、触屏滑动、虚拟方向键统一翻译成游戏意图，不参与渲染。
   ============================================================ */
(function (global) {
  'use strict';

  /** 键位 → 方向映射 */
  var KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right'
  };

  /** 需要拦截默认行为的按键（避免页面滚动 / 按钮被空格触发） */
  var BLOCKED_KEYS = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, ' ': 1, Spacebar: 1
  };

  var SWIPE_THRESHOLD = 22; // 触发一次转向所需的最小位移（CSS 像素）

  /**
   * @constructor
   * @param {object} config
   * @param {SnakeGame} config.game
   * @param {HTMLCanvasElement} config.canvas 用于监听滑动手势
   * @param {HTMLElement} [config.dpad] 虚拟方向键容器
   * @param {{onToggle: Function, onSubmit: Function, onRestart: Function}} config.handlers
   */
  function InputController(config) {
    this.game = config.game;
    this.canvas = config.canvas;
    this.dpad = config.dpad;
    this.handlers = config.handlers || {};

    this._touchStart = null;
    this._bind();
  }

  InputController.prototype._bind = function () {
    var self = this;

    this._onKeyDown = function (event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      var key = event.key;
      var lower = typeof key === 'string' && key.length === 1 ? key.toLowerCase() : key;

      if (BLOCKED_KEYS[key]) event.preventDefault();

      if (KEY_MAP[lower]) {
        self._requestDirection(KEY_MAP[lower]);
        return;
      }

      switch (key) {
        case ' ':
        case 'Spacebar':
        case 'p':
        case 'P':
          event.preventDefault();
          self._fire('onToggle');
          break;
        case 'Enter':
          event.preventDefault();
          self._fire('onSubmit');
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          self._fire('onRestart');
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', this._onKeyDown, { passive: false });

    // ---- 触屏滑动 ----
    this._onTouchStart = function (event) {
      if (event.touches.length !== 1) {
        self._touchStart = null;
        return;
      }
      var t = event.touches[0];
      self._touchStart = { x: t.clientX, y: t.clientY };
    };

    this._onTouchMove = function (event) {
      if (!self._touchStart || event.touches.length !== 1) return;
      var t = event.touches[0];
      var dx = t.clientX - self._touchStart.x;
      var dy = t.clientY - self._touchStart.y;

      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
      event.preventDefault();

      if (Math.abs(dx) > Math.abs(dy)) {
        self._requestDirection(dx > 0 ? 'right' : 'left');
      } else {
        self._requestDirection(dy > 0 ? 'down' : 'up');
      }
      // 重置起点，支持一次按住连续转向
      self._touchStart = { x: t.clientX, y: t.clientY };
    };

    this._onTouchEnd = function () {
      self._touchStart = null;
    };

    if (this.canvas) {
      this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
      this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
      this.canvas.addEventListener('touchend', this._onTouchEnd, { passive: true });
      this.canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: true });
      // 避免长按弹出系统菜单
      this.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    // ---- 虚拟方向键 ----
    if (this.dpad) {
      this.dpad.addEventListener('pointerdown', function (event) {
        var btn = event.target.closest('[data-dir]');
        if (!btn) return;
        event.preventDefault();
        btn.classList.add('is-active');
        self._requestDirection(btn.dataset.dir);
      });

      var release = function (event) {
        var btn = event.target.closest && event.target.closest('[data-dir]');
        if (btn) btn.classList.remove('is-active');
      };
      this.dpad.addEventListener('pointerup', release);
      this.dpad.addEventListener('pointercancel', release);
      this.dpad.addEventListener('pointerleave', release);
    }
  };

  /** 方向请求：仅在运行中生效，避免暂停/结束时攒下无效指令 */
  InputController.prototype._requestDirection = function (dir) {
    if (this.game.state !== SnakeGame.STATE.RUNNING) return;
    this.game.setDirection(dir);
  };

  InputController.prototype._fire = function (name) {
    var fn = this.handlers[name];
    if (typeof fn === 'function') fn();
  };

  global.InputController = InputController;
})(window);