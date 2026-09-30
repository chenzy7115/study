/* ============================================================
   音频层：AudioManager
   使用 Web Audio API 实时合成音效，不依赖任何音频文件，
   因此离线可用、零加载延迟，也不会阻塞主线程。
   对外只暴露 play(name) / unlock() / setMuted()，与 DOM 无关。
   ============================================================ */
(function (global) {
  'use strict';

  var AudioCtxCtor = global.AudioContext || global.webkitAudioContext;

  var DEFAULTS = {
    volume: 0.55,   // 主音量：留出余量，避免盖过界面与系统声音
    muted: false
  };

  /* ------------------------------------------------------------
     音效配方：均为短促、彼此差异明显的音色
     ------------------------------------------------------------ */

  var RECIPES = {
    /** 开局：上行琶音 C5-E5-G5-C6，明亮而「向上」 */
    start: function (t0) {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < notes.length; i++) {
        this._tone({
          at: t0 + i * 0.085,
          freq: notes[i],
          duration: 0.2,
          gain: 0.16,
          type: 'triangle',
          attack: 0.008,
          filter: 5200
        });
      }
    },

    /** 吃到苹果：清脆上扬的短音；连吃越多音高越高，形成正反馈 */
    eat: function (t0, opts) {
      var step = Math.min(opts.combo || 0, 12);          // 最多升一个八度
      var base = 587.33 * Math.pow(2, step / 12);        // 以 D5 为基准逐半音上行
      this._tone({
        at: t0,
        freq: base,
        to: base * 1.5,
        duration: 0.13,
        gain: 0.24,
        type: 'triangle',
        attack: 0.004,
        filter: 6000
      });
      this._tone({
        at: t0 + 0.035,
        freq: base * 2,
        to: base * 2.6,
        duration: 0.1,
        gain: 0.09,
        type: 'sine',
        attack: 0.004
      });
    },

    /** 结束：下行音列 + 低频闷响，与开局形成明确的反向对比 */
    gameover: function (t0) {
      var notes = [440, 349.23, 293.66, 207.65];
      for (var i = 0; i < notes.length; i++) {
        this._tone({
          at: t0 + i * 0.13,
          freq: notes[i],
          to: notes[i] * 0.94,
          duration: 0.36,
          gain: 0.17,
          type: 'sawtooth',
          attack: 0.012,
          filter: 1800
        });
      }
      this._tone({
        at: t0,
        freq: 110,
        to: 55,
        duration: 0.62,
        gain: 0.2,
        type: 'sine',
        attack: 0.01
      });
    }
  };

  /**
   * @constructor
   * @param {{volume?: number, muted?: boolean}} [options]
   */
  function AudioManager(options) {
    var opts = options || {};
    this.volume = typeof opts.volume === 'number' ? opts.volume : DEFAULTS.volume;
    this.muted = !!opts.muted;
    this.supported = !!AudioCtxCtor;

    this.ctx = null;
    this.master = null;
  }

  AudioManager.prototype.isSupported = function () {
    return this.supported;
  };

  /* ---------- 生命周期 ---------- */

  /**
   * 由用户手势调用，创建并唤醒 AudioContext。
   * 浏览器自动播放策略要求音频必须在用户交互中启动。
   * @returns {boolean} 当前是否可发声
   */
  AudioManager.prototype.unlock = function () {
    if (!this.supported) return false;
    try {
      if (!this.ctx) this._createContext();
      if (this.ctx && this.ctx.state !== 'running' && this.ctx.resume) {
        var res = this.ctx.resume();
        if (res && typeof res.catch === 'function') res.catch(function () {});
      }
      return !!(this.ctx && this.ctx.state === 'running');
    } catch (err) {
      return false;
    }
  };

  AudioManager.prototype._createContext = function () {
    var ctx = new AudioCtxCtor();
    var master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;

    // 压缩器：多个音效叠加时抑制削波，保证整体音量稳定
    if (ctx.createDynamicsCompressor) {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      master.connect(comp);
      comp.connect(ctx.destination);
    } else {
      master.connect(ctx.destination);
    }

    this.ctx = ctx;
    this.master = master;
  };

  /* ---------- 音量 ---------- */

  AudioManager.prototype.setMuted = function (muted) {
    this.muted = !!muted;
    if (this.ctx && this.master) {
      var t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.02);
    }
    return this.muted;
  };

  AudioManager.prototype.toggleMuted = function () {
    return this.setMuted(!this.muted);
  };

  /* ---------- 播放 ---------- */

  /**
   * 播放一个音效
   * @param {string} name start | eat | gameover
   * @param {object} [options] 例如 eat 的 { combo }
   * @returns {boolean} 是否成功触发
   */
  AudioManager.prototype.play = function (name, options) {
    if (!this.supported || this.muted) return false;

    var recipe = RECIPES[name];
    if (!recipe) return false;

    if (!this.ctx) this.unlock();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.unlock();

    try {
      recipe.call(this, this.ctx.currentTime + 0.01, options || {});
      return true;
    } catch (err) {
      return false;
    }
  };

  /**
   * 合成单个音符
   * @param {object} p at / freq / to / duration / gain / type / attack / filter
   */
  AudioManager.prototype._tone = function (p) {
    var ctx = this.ctx;
    var t0 = p.at;
    var duration = p.duration;
    var attack = p.attack == null ? 0.006 : p.attack;

    var osc = ctx.createOscillator();
    osc.type = p.type || 'triangle';
    osc.frequency.setValueAtTime(p.freq, t0);
    if (p.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, p.to), t0 + duration);

    var gain = ctx.createGain();
    var peak = Math.max(0.0001, p.gain);
    // 指数包络不能取 0，用极小值代替
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    var tail = osc;
    if (p.filter) {
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = p.filter;
      osc.connect(lp);
      tail = lp;
    }
    tail.connect(gain);
    gain.connect(this.master);

    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  };

  global.AudioManager = AudioManager;
})(window);