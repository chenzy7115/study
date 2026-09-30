/* ============================================================
   装配层：把逻辑层、渲染层、交互层与 DOM 界面连接起来
   ============================================================ */
(function (global) {
  'use strict';

  var STATE = SnakeGame.STATE;
  var BEST_KEY = 'snake.bestScore';
  var MUTED_KEY = 'snake.soundMuted';

  /** 各状态对应的界面文案 */
  var OVERLAY_TEXT = {
    idle: {
      badge: '准备开始',
      badgeClass: '',
      title: '准备好了吗？',
      desc: '使用方向键或 WASD 控制蛇的移动，吃掉食物让身体变长。',
      action: '开始游戏'
    },
    paused: {
      badge: '已暂停',
      badgeClass: 'is-warn',
      title: '游戏已暂停',
      desc: '按空格键或点击下方按钮继续本局。',
      action: '继续游戏'
    }
  };

  var DEATH_TEXT = {
    wall: '撞到墙壁了',
    self: '撞到自己了',
    win: '填满全场，完美通关！'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function readBest() {
    try {
      var raw = global.localStorage.getItem(BEST_KEY);
      var n = parseInt(raw, 10);
      return isNaN(n) || n < 0 ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      global.localStorage.setItem(BEST_KEY, String(value));
    } catch (e) {
      /* 隐私模式等场景下静默失败 */
    }
  }

  function readMuted() {
    try {
      return global.localStorage.getItem(MUTED_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function writeMuted(value) {
    try {
      global.localStorage.setItem(MUTED_KEY, value ? '1' : '0');
    } catch (e) {
      /* 忽略存储不可用的情况 */
    }
  }

  function init() {
    /* ---------- 依赖装配 ---------- */
    var canvas = $('game-canvas');
    var board = $('board');
    var overlay = $('overlay');
    var overlayBadge = $('overlay-badge');
    var overlayTitle = $('overlay-title');
    var overlayDesc = $('overlay-desc');
    var overlayBtn = $('overlay-btn');
    var primaryBtn = $('primary-btn');
    var restartBtn = $('restart-btn');
    var soundBtn = $('sound-btn');
    var scoreValue = $('score-value');
    var bestValue = $('best-value');
    var lengthValue = $('length-value');
    var speedValue = $('speed-value');

    var game = new SnakeGame();
    var renderer = new CanvasRenderer(canvas, game);
    var audio = new AudioManager({ muted: readMuted() });

    var best = readBest();
    var isNewRecord = false;

    /* ---------- 界面同步 ---------- */

    function bump(el) {
      el.classList.remove('is-bump');
      void el.offsetWidth; // 强制重排以重启动画
      el.classList.add('is-bump');
    }

    function syncStats(info) {
      scoreValue.textContent = info.score;
      lengthValue.textContent = info.length;
      speedValue.textContent = info.speedLevel;
      bestValue.textContent = best;
    }

    function syncOverlay() {
      var state = game.state;

      if (state === STATE.RUNNING) {
        overlay.classList.remove('is-visible');
        primaryBtn.textContent = '暂停';
        return;
      }

      overlay.classList.add('is-visible');

      if (state === STATE.OVER) {
        overlayBadge.textContent = DEATH_TEXT[game.deathReason] || '本局结束';
        overlayBadge.className = 'overlay__badge is-danger';
        overlayTitle.textContent = isNewRecord ? '新纪录！' : '游戏结束';
        overlayDesc.textContent = '本局得分 ' + game.score + ' 分 · 蛇长 ' + game.snake.length + ' 节'
          + (isNewRecord ? '，已刷新你的最高分。' : '，最高分 ' + best + ' 分。');
        overlayBtn.textContent = '再来一局';
        primaryBtn.textContent = '再来一局';
        return;
      }

      var text = OVERLAY_TEXT[state] || OVERLAY_TEXT.idle;
      overlayBadge.textContent = text.badge;
      overlayBadge.className = 'overlay__badge' + (text.badgeClass ? ' ' + text.badgeClass : '');
      overlayTitle.textContent = text.title;
      overlayDesc.textContent = text.desc;
      overlayBtn.textContent = text.action;
      primaryBtn.textContent = text.action;
    }

    function syncSound() {
      var available = audio.isSupported();
      soundBtn.disabled = !available;
      soundBtn.setAttribute('aria-pressed', audio.muted ? 'false' : 'true');
      soundBtn.textContent = !available ? '音效：不可用' : (audio.muted ? '音效：关' : '音效：开');
    }

    /* ---------- 用户动作 ---------- */

    function startGame() {
      if (game.state !== STATE.IDLE && game.state !== STATE.OVER) return;
      isNewRecord = false;
      if (game.state === STATE.OVER) game.reset();
      game.start();
    }

    function restartGame() {
      isNewRecord = false;
      game.reset();
      game.start();
    }

    function toggleGame() {
      if (game.state === STATE.RUNNING) game.pause();
      else if (game.state === STATE.PAUSED) game.resume();
      else startGame();
    }

    primaryBtn.addEventListener('click', toggleGame);
    overlayBtn.addEventListener('click', toggleGame);
    restartBtn.addEventListener('click', restartGame);

    soundBtn.addEventListener('click', function () {
      audio.toggleMuted();
      writeMuted(audio.muted);
      syncSound();
      // 打开音效时给一次即时反馈
      if (!audio.muted) audio.play('eat', { combo: 7 });
    });

    // 浏览器自动播放策略要求音频上下文在用户手势中启动。
    // 用捕获阶段监听，确保早于按钮自身的 click 回调完成解锁。
    function unlockAudio() {
      audio.unlock();
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (type) {
      document.addEventListener(type, unlockAudio, { capture: true, passive: true });
    });

    new InputController({
      game: game,
      canvas: canvas,
      dpad: $('dpad'),
      handlers: {
        onToggle: toggleGame,
        onSubmit: function () {
          if (game.state === STATE.OVER || game.state === STATE.IDLE) restartGame();
          else toggleGame();
        },
        onRestart: restartGame
      }
    });

    /* ---------- 逻辑事件 → 视觉反馈 ---------- */

    game.on('score', function (info) {
      syncStats(info);
      if (info.score > best) {
        best = info.score;
        isNewRecord = true;
        bestValue.textContent = best;
      }
    });

    game.on('statechange', function (payload) {
      syncOverlay();
      // 仅在新开局时播放开始音；从暂停恢复不算新一局
      if (payload.state === STATE.RUNNING && payload.previous !== STATE.PAUSED) {
        audio.play('start');
      }
    });

    game.on('eat', function (payload) {
      renderer.addEatEffect(payload.x, payload.y);
      bump(scoreValue);
      audio.play('eat', { combo: payload.foodEaten });
    });

    game.on('gameover', function () {
      renderer.addDeathFlash();
      board.classList.add('is-danger');
      global.setTimeout(function () { board.classList.remove('is-danger'); }, 420);
      if (game.score >= best) writeBest(best);
      syncOverlay();
      audio.play('gameover');
    });

    /* ---------- 尺寸自适应 ---------- */

    if (global.ResizeObserver) {
      var ro = new ResizeObserver(function () { renderer.resize(); });
      ro.observe(board);
    }
    global.addEventListener('resize', function () { renderer.resize(); });
    global.addEventListener('orientationchange', function () {
      global.setTimeout(function () { renderer.resize(); }, 120);
    });

    /* ---------- 切到后台自动暂停 ---------- */

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) game.pause();
    });

    /* ---------- 主循环 ---------- */

    var lastTime = 0;
    function frame(now) {
      var dt = lastTime ? now - lastTime : 0;
      lastTime = now;

      game.update(dt);
      renderer.render(now);

      global.requestAnimationFrame(frame);
    }

    bestValue.textContent = best;
    syncStats(game.getScoreInfo());
    syncOverlay();
    syncSound();
    global.requestAnimationFrame(frame);

    // 便于在控制台调试
    global.__snake = { game: game, renderer: renderer, audio: audio };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);