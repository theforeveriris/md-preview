(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  const WAVE_CATEGORIES = {
    "脉冲类": ["快速脉冲", "慢速脉冲", "双脉冲", "单脉冲", "窄脉冲串", "宽脉冲"],
    "基础波": ["正弦波", "三角波", "方波", "锯齿波"],
    "自然类": ["海浪", "微风", "心跳", "弹跳", "潮汐", "涟漪"],
    "衰减上升": ["指数衰减", "指数上升", "快速衰减", "缓慢衰减", "快速上升", "缓慢上升"],
    "噪声类": ["噪声", "粗糙噪声", "细碎噪声"],
    "阶梯折线": ["阶梯波", "微阶梯", "锯齿折线"],
    "组合类": ["升降波", "脉冲衰减", "正弦衰减", "阶梯正弦", "呼吸波"],
    "特殊形状": ["尖峰", "谷底", "平顶", "双峰", "三峰", "山丘", "悬崖"],
    "氛围类": ["地震波", "雷鸣", "滴答", "渐强", "渐弱"]
  };

  const ALL_TYPES = [];
  const TYPE_TO_CATEGORY = {};
  for (const [cat, types] of Object.entries(WAVE_CATEGORIES)) {
    for (const t of types) {
      ALL_TYPES.push(t);
      TYPE_TO_CATEGORY[t] = cat;
    }
  }

  const INTENSITY_PRESETS = {
    low:    { max: 30, min: 0 },
    medium: { max: 60, min: 10 },
    high:   { max: 85, min: 25 },
    max:    { max: 100, min: 40 },
    full:   { max: 100, min: 0 }
  };

  const SECTION_TIME_MAP = [];
  (function buildSectionTimeMap() {
    for (let i = 0; i <= 99; i++) {
      if (i <= 20) {
        SECTION_TIME_MAP.push(+(0.5 + i * 0.25).toFixed(1));
      } else if (i <= 50) {
        SECTION_TIME_MAP.push(+(5.5 + (i - 20) * 0.3).toFixed(1));
      } else if (i <= 70) {
        SECTION_TIME_MAP.push(+(14.5 + (i - 50) * 0.45).toFixed(1));
      } else {
        SECTION_TIME_MAP.push(+(23.5 + (i - 70) * 0.9).toFixed(1));
      }
    }
  })();

  const FREQ_A_MAP = [];
  const FREQ_B_MAP = [];
  (function buildFreqMaps() {
    for (let i = 0; i <= 83; i++) {
      let freqA, freqB;
      if (i <= 20) {
        freqA = 5 + i * 2.5;
        freqB = 20 + i * 5;
      } else if (i <= 50) {
        freqA = 55 + (i - 20) * 3;
        freqB = 120 + (i - 20) * 6;
      } else {
        freqA = 145 + (i - 50) * 5;
        freqB = 300 + (i - 50) * 10;
      }
      FREQ_A_MAP.push(Math.round(freqA));
      FREQ_B_MAP.push(Math.round(freqB));
    }
  })();

  class SeededRandom {
    constructor(seed) {
      this.seed = seed || Date.now();
    }
    next() {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return this.seed / 233280;
    }
    range(min, max) {
      return min + this.next() * (max - min);
    }
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    }
    choice(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }
    chance(p) {
      return this.next() < p;
    }
  }

  let rng = new SeededRandom();

  function fmt(v) {
    v = Math.max(0, Math.min(100, v));
    return v.toFixed(2);
  }

  function makePoint(value, isKey) {
    const flag = isKey ? 1 : 0;
    return `${fmt(value)}-${flag}`;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function applyInterpolation(t, style) {
    t = clamp(t, 0, 1);
    if (style === "ease_in") return t * t;
    if (style === "ease_out") return 1 - (1 - t) ** 2;
    if (style === "ease_in_out") return 3 * t * t - 2 * t * t * t;
    return t;
  }

  function rescaleWaveform(values, minVal, maxVal) {
    if (!values.length) return values;
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    if (vMax - vMin < 0.01) {
      const mid = (minVal + maxVal) / 2;
      return values.map(() => mid);
    }
    return values.map(v => minVal + (v - vMin) / (vMax - vMin) * (maxVal - minVal));
  }

  class IntensityParams {
    constructor(intensity, maxIntensity, minIntensity) {
      this.intensity = clamp(intensity, 1, 10);
      this.maxIntensity = maxIntensity;
      this.minIntensity = minIntensity;
      const n = (this.intensity - 1) / 9;
      this.freqMult = 0.3 + n * 3.7;
      this.ampRatio = 0.2 + n * 0.8;
      this.keyframeDensity = 0.05 + n * 0.40;
      this.sharpness = n;
      this.noiseLevel = 0.1 + n * 0.4;
    }
    get amplitudeRange() {
      const span = this.maxIntensity - this.minIntensity;
      const effectiveSpan = span * this.ampRatio;
      const center = (this.maxIntensity + this.minIntensity) / 2;
      const lo = clamp(center - effectiveSpan / 2, this.minIntensity, this.maxIntensity);
      const hi = clamp(center + effectiveSpan / 2, this.minIntensity, this.maxIntensity);
      return [lo, hi];
    }
    freqCycles(base) {
      return Math.max(0.5, base * this.freqMult);
    }
    shouldBeKeyframe() {
      return rng.chance(this.keyframeDensity);
    }
  }

  const waveformGenerators = {
    "正弦波": (n, ip, interp) => {
      const cycles = ip.freqCycles(rng.choice([0.5, 1, 1.5]));
      const [lo, hi] = ip.amplitudeRange;
      const center = (lo + hi) / 2;
      const halfSpan = (hi - lo) / 2;
      const values = [];
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(n - 1, 1);
        values.push(center + halfSpan * Math.sin(2 * Math.PI * cycles * t));
      }
      return values;
    },
    "三角波": (n, ip, interp) => {
      const cycles = ip.freqCycles(rng.choice([0.5, 1, 1.5]));
      const [lo, hi] = ip.amplitudeRange;
      const values = [];
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(n - 1, 1);
        const phase = (cycles * t) % 1;
        let v;
        if (phase < 0.25) v = lo + (hi - lo) * (phase * 4);
        else if (phase < 0.75) v = hi - (hi - lo) * ((phase - 0.25) * 4);
        else v = lo + (hi - lo) * ((phase - 0.75) * 4);
        values.push(v);
      }
      return values;
    },
    "方波": (n, ip, interp) => {
      const cycles = ip.freqCycles(rng.choice([0.5, 1, 1.5]));
      const [lo, hi] = ip.amplitudeRange;
      const duty = 0.3 + ip.sharpness * 0.2;
      const values = [];
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(n - 1, 1);
        const phase = (cycles * t) % 1;
        values.push(phase < duty ? hi : lo);
      }
      return values;
    },
    "锯齿波": (n, ip, interp) => {
      const cycles = ip.freqCycles(rng.choice([1, 1.5, 2]));
      const [lo, hi] = ip.amplitudeRange;
      const values = [];
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(n - 1, 1);
        const phase = (cycles * t) % 1;
        values.push(lo + (hi - lo) * phase);
      }
      return values;
    },
    "快速脉冲": (n, ip, interp) => genPulseTrain(n, ip, "fast"),
    "慢速脉冲": (n, ip, interp) => genPulseTrain(n, ip, "slow"),
    "双脉冲": (n, ip, interp) => genPulseTrain(n, ip, "double"),
    "单脉冲": (n, ip, interp) => genPulseTrain(n, ip, "single"),
    "窄脉冲串": (n, ip, interp) => genPulseTrain(n, ip, "narrow"),
    "宽脉冲": (n, ip, interp) => genPulseTrain(n, ip, "wide"),
    "指数衰减": (n, ip, interp) => genDecay(n, ip, "normal"),
    "快速衰减": (n, ip, interp) => genDecay(n, ip, "fast"),
    "缓慢衰减": (n, ip, interp) => genDecay(n, ip, "slow"),
    "指数上升": (n, ip, interp) => genRise(n, ip, "normal"),
    "快速上升": (n, ip, interp) => genRise(n, ip, "fast"),
    "缓慢上升": (n, ip, interp) => genRise(n, ip, "slow"),
    "噪声": (n, ip, interp) => genNoise(n, ip, "normal"),
    "粗糙噪声": (n, ip, interp) => genNoise(n, ip, "rough"),
    "细碎噪声": (n, ip, interp) => genNoise(n, ip, "fine"),
    "阶梯波": (n, ip, interp) => genStaircase(n, ip, "normal"),
    "微阶梯": (n, ip, interp) => genStaircase(n, ip, "micro"),
    "锯齿折线": (n, ip, interp) => genZigzag(n, ip),
    "海浪": (n, ip, interp) => genOcean(n, ip),
    "微风": (n, ip, interp) => genWind(n, ip),
    "心跳": (n, ip, interp) => genHeartbeat(n, ip),
    "弹跳": (n, ip, interp) => genBounce(n, ip),
    "潮汐": (n, ip, interp) => genTide(n, ip),
    "涟漪": (n, ip, interp) => genRipple(n, ip),
    "升降波": (n, ip, interp) => genUpDown(n, ip, interp),
    "脉冲衰减": (n, ip, interp) => genPulseDecay(n, ip, interp),
    "正弦衰减": (n, ip, interp) => genSineDecay(n, ip),
    "阶梯正弦": (n, ip, interp) => genStairSine(n, ip),
    "呼吸波": (n, ip, interp) => genBreathing(n, ip),
    "尖峰": (n, ip, interp) => genSpike(n, ip, interp),
    "谷底": (n, ip, interp) => genValley(n, ip, interp),
    "平顶": (n, ip, interp) => genFlatTop(n, ip, interp),
    "双峰": (n, ip, interp) => genMultiPeak(n, ip, interp, 2),
    "三峰": (n, ip, interp) => genMultiPeak(n, ip, interp, 3),
    "山丘": (n, ip, interp) => genHill(n, ip, interp),
    "悬崖": (n, ip, interp) => genCliff(n, ip, interp),
    "地震波": (n, ip, interp) => genEarthquake(n, ip),
    "雷鸣": (n, ip, interp) => genThunder(n, ip),
    "滴答": (n, ip, interp) => genTick(n, ip),
    "渐强": (n, ip, interp) => genCrescendo(n, ip),
    "渐弱": (n, ip, interp) => genDecrescendo(n, ip)
  };

  function genPulseTrain(n, ip, variant) {
    let numPulses, duty;
    switch (variant) {
      case "fast": numPulses = rng.int(4, 10); duty = rng.range(0.1, 0.3); break;
      case "slow": numPulses = rng.int(2, 4); duty = rng.range(0.3, 0.6); break;
      case "narrow": numPulses = rng.int(6, 14); duty = rng.range(0.05, 0.15); break;
      case "wide": numPulses = rng.int(1, 3); duty = rng.range(0.6, 0.9); break;
      case "double": numPulses = 2; duty = rng.range(0.15, 0.4); break;
      case "single": numPulses = 1; duty = rng.range(0.3, 0.8); break;
      default: numPulses = rng.int(2, 8); duty = rng.range(0.1, 0.5);
    }
    numPulses = Math.max(1, Math.round(numPulses * ip.freqMult * 0.5));
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const cycle = (numPulses * t) % 1;
      values.push(cycle < duty ? hi : lo);
    }
    return values;
  }

  function genDecay(n, ip, variant) {
    let rate;
    if (variant === "fast") rate = rng.range(5, 12);
    else if (variant === "slow") rate = rng.range(0.3, 1.5);
    else rate = rng.range(1.5, 5);
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      values.push(lo + (hi - lo) * Math.exp(-rate * t));
    }
    return values;
  }

  function genRise(n, ip, variant) {
    let rate;
    if (variant === "fast") rate = rng.range(5, 12);
    else if (variant === "slow") rate = rng.range(0.3, 1.5);
    else rate = rng.range(1.5, 5);
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      values.push(lo + (hi - lo) * (1 - Math.exp(-rate * t)));
    }
    return values;
  }

  function genNoise(n, ip, variant) {
    let roughness;
    if (variant === "rough") roughness = rng.range(0.6, 1);
    else if (variant === "fine") roughness = rng.range(0.1, 0.35);
    else roughness = rng.range(0.2, 0.7);
    const [lo, hi] = ip.amplitudeRange;
    const center = (lo + hi) / 2;
    const values = [];
    let v = center;
    for (let i = 0; i < n; i++) {
      v += rng.range(-(hi - lo) * roughness * 0.3, (hi - lo) * roughness * 0.3);
      v = clamp(v, lo, hi);
      values.push(v);
    }
    return values;
  }

  function genStaircase(n, ip, variant) {
    const steps = variant === "micro" ? rng.int(10, 20) : rng.int(3, 8);
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      values.push(lo + (hi - lo) * (Math.floor(t * steps) / steps));
    }
    return values;
  }

  function genZigzag(n, ip) {
    let numZigs = rng.int(3, 8);
    numZigs = Math.max(2, Math.round(numZigs * ip.freqMult * 0.5));
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const seg = (numZigs * 2 * t) % 2;
      if (seg < 1) values.push(lo + (hi - lo) * seg);
      else values.push(hi - (hi - lo) * (seg - 1));
    }
    return values;
  }

  function genOcean(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const center = (lo + hi) / 2;
    const span = hi - lo;
    const f1 = ip.freqCycles(0.3);
    const f2 = ip.freqCycles(0.8);
    const f3 = ip.freqCycles(1.7);
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const v = center + span * 0.2 * Math.sin(2 * Math.PI * f1 * t)
                       + span * 0.15 * Math.sin(2 * Math.PI * f2 * t)
                       + span * 0.1 * Math.sin(2 * Math.PI * f3 * t);
      values.push(clamp(v, lo, hi));
    }
    return values;
  }

  function genWind(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const center = lo + (hi - lo) * 0.3;
    const fGust = ip.freqCycles(1.5);
    const fBase = ip.freqCycles(0.2);
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const base = center + (hi - lo) * 0.15 * Math.sin(2 * Math.PI * fBase * t);
      const gust = (hi - lo) * 0.4 * Math.max(0, Math.sin(2 * Math.PI * fGust * t)) ** 4;
      values.push(clamp(base + gust, lo, hi));
    }
    return values;
  }

  function genHeartbeat(n, ip) {
    const beats = Math.max(1, Math.round(ip.freqCycles(2)));
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const bt = (beats * t) % 1;
      let v;
      if (bt < 0.08) v = lo + (hi - lo) * (bt / 0.08);
      else if (bt < 0.13) v = lo + (hi - lo) * (1 - (bt - 0.08) / 0.05) * 0.6;
      else if (bt < 0.18) v = lo + (hi - lo) * ((bt - 0.13) / 0.05) * 0.8;
      else if (bt < 0.28) v = lo + (hi - lo) * (1 - (bt - 0.18) / 0.10) * 0.8;
      else v = lo;
      values.push(v);
    }
    return values;
  }

  function genBounce(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const bounces = Math.max(2, Math.round(ip.freqCycles(3)));
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      values.push(lo + (hi - lo) * Math.abs(Math.sin(2 * Math.PI * bounces * t)) * Math.exp(-2.5 * t));
    }
    return values;
  }

  function genTide(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const center = (lo + hi) / 2;
    const f1 = ip.freqCycles(0.15);
    const f2 = ip.freqCycles(0.04);
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const v = center + (hi - lo) * 0.3 * Math.sin(2 * Math.PI * f1 * t)
                       + (hi - lo) * 0.15 * Math.sin(2 * Math.PI * f2 * t + 1);
      values.push(clamp(v, lo, hi));
    }
    return values;
  }

  function genRipple(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const f = ip.freqCycles(1.5);
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      values.push(lo + (hi - lo) * Math.abs(Math.sin(2 * Math.PI * f * t)) * (1 - Math.abs(2 * t - 1) ** 2));
    }
    return values;
  }

  function genUpDown(n, ip, interp) {
    const [lo, hi] = ip.amplitudeRange;
    const mid = Math.floor(n / 2);
    const values = [];
    for (let i = 0; i < mid; i++) {
      const t = i / Math.max(mid - 1, 1);
      values.push(lerp(lo, hi, applyInterpolation(t, interp)));
    }
    for (let i = 0; i < n - mid; i++) {
      const t = n - mid > 1 ? i / (n - mid - 1) : 1;
      values.push(lerp(hi, lo, applyInterpolation(t, interp)));
    }
    return values;
  }

  function genPulseDecay(n, ip, interp) {
    const [lo, hi] = ip.amplitudeRange;
    const pulseN = Math.max(2, Math.floor(n / 3));
    const values = [];
    for (let i = 0; i < pulseN; i++) {
      const t = i / Math.max(pulseN - 1, 1);
      values.push(lerp(lo, hi, applyInterpolation(t, "ease_out")));
    }
    const decayN = n - pulseN;
    const rate = rng.range(1.5, 5);
    for (let i = 0; i < decayN; i++) {
      const t = i / Math.max(decayN - 1, 1);
      values.push(lo + (hi - lo) * 0.7 * Math.exp(-rate * t));
    }
    return values;
  }

  function genSineDecay(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const cycles = ip.freqCycles(1.5);
    const rate = rng.range(1, 4);
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const envelope = Math.exp(-rate * t);
      values.push(lo + (hi - lo) * (0.5 + 0.5 * Math.sin(2 * Math.PI * cycles * t)) * envelope);
    }
    return values;
  }

  function genStairSine(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const steps = rng.int(3, 6);
    const f = ip.freqCycles(1);
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const stair = Math.floor(t * steps) / steps;
      const sine = 0.5 + 0.5 * Math.sin(2 * Math.PI * f * t);
      values.push(clamp(lo + (hi - lo) * stair * sine, lo, hi));
    }
    return values;
  }

  function genBreathing(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const cycles = ip.freqCycles(rng.choice([1, 2]));
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const raw = Math.sin(2 * Math.PI * cycles * t);
      values.push(lo + (hi - lo) * (0.5 + 0.5 * raw) ** 1.5);
    }
    return values;
  }

  function genSpike(n, ip, interp) {
    const [lo, hi] = ip.amplitudeRange;
    const peakIdx = Math.max(1, Math.floor(n / 3));
    const values = [];
    for (let i = 0; i <= peakIdx; i++) {
      const t = i / Math.max(peakIdx, 1);
      values.push(lerp(lo, hi, applyInterpolation(t, "ease_out")));
    }
    for (let i = 0; i < n - peakIdx - 1; i++) {
      const t = (i + 1) / Math.max(n - peakIdx - 1, 1);
      values.push(lerp(hi, lo, applyInterpolation(t, "ease_in")));
    }
    return values;
  }

  function genValley(n, ip, interp) {
    const v = genSpike(n, ip, interp);
    const [lo, hi] = ip.amplitudeRange;
    return v.map(x => lo + hi - x);
  }

  function genFlatTop(n, ip, interp) {
    const [lo, hi] = ip.amplitudeRange;
    const riseEnd = Math.floor(n * 0.2);
    const fallStart = Math.floor(n * 0.8);
    const values = [];
    for (let i = 0; i < riseEnd; i++) {
      const t = i / Math.max(riseEnd, 1);
      values.push(lerp(lo, hi, applyInterpolation(t, interp)));
    }
    for (let i = riseEnd; i < fallStart; i++) {
      values.push(hi);
    }
    for (let i = fallStart; i < n; i++) {
      const t = (i - fallStart) / Math.max(n - fallStart, 1);
      values.push(lerp(hi, lo, applyInterpolation(t, interp)));
    }
    return values;
  }

  function genMultiPeak(n, ip, interp, numPeaks) {
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const phase = (numPeaks * t) % 1;
      const v = phase < 0.5
        ? lerp(lo, hi, applyInterpolation(phase * 2, "ease_out"))
        : lerp(hi, lo, applyInterpolation((phase - 0.5) * 2, "ease_in"));
      values.push(v);
    }
    return values;
  }

  function genHill(n, ip, interp) {
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const v = Math.sin(Math.PI * t) ** 0.7;
      values.push(lo + (hi - lo) * v);
    }
    return values;
  }

  function genCliff(n, ip, interp) {
    const [lo, hi] = ip.amplitudeRange;
    const cliffPos = rng.range(0.3, 0.7);
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      if (t < cliffPos) {
        values.push(lerp(lo, hi, applyInterpolation(t / cliffPos, "ease_out")));
      } else {
        values.push(lo + (hi - lo) * 0.3 * Math.exp(-8 * (t - cliffPos)));
      }
    }
    return values;
  }

  function genEarthquake(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const center = (lo + hi) / 2;
    const values = [];
    let v = center;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const intensity = Math.exp(-3 * t) * (1 + Math.sin(15 * t) * 0.5);
      v += rng.range(-(hi - lo) * 0.4 * intensity, (hi - lo) * 0.4 * intensity);
      v = clamp(v, lo, hi);
      values.push(v);
    }
    return values;
  }

  function genThunder(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const values = [];
    let rumble = lo;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const env = Math.exp(-2 * t);
      rumble += rng.range(-(hi - lo) * 0.15 * env, (hi - lo) * 0.15 * env);
      rumble = clamp(rumble, lo, hi);
      const crack = Math.random() < 0.05 * env ? hi : lo;
      const v = Math.max(rumble, crack * env);
      values.push(clamp(v, lo, hi));
    }
    return values;
  }

  function genTick(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const ticks = Math.max(2, Math.round(ip.freqCycles(4)));
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const phase = (ticks * t) % 1;
      const v = phase < 0.1 ? hi * (0.5 + 0.5 * Math.sin(phase * 10 * Math.PI)) : lo;
      values.push(clamp(v, lo, hi));
    }
    return values;
  }

  function genCrescendo(n, ip) {
    const [lo, hi] = ip.amplitudeRange;
    const cycles = ip.freqCycles(2);
    const values = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const env = t ** 1.5;
      values.push(lo + (hi - lo) * (0.5 + 0.5 * Math.sin(2 * Math.PI * cycles * t)) * env);
    }
    return values;
  }

  function genDecrescendo(n, ip) {
    const v = genCrescendo(n, ip);
    return v.reverse();
  }

  function generateWaveform(waveType, ip, interpolation, sectionsConfig, pointsConfig, mix, availableTypes) {
    let numSections;
    if (sectionsConfig.type === "fixed") numSections = sectionsConfig.value;
    else numSections = rng.int(sectionsConfig.min, sectionsConfig.max);

    const restTime = rng.int(30, 60);
    const speedMult = rng.range(0.8, 1.2);
    const unknown = 0;

    const freqA = rng.int(30, 60);
    const freqB = rng.int(30, 60);
    const durationIdx = rng.int(15, 40);

    let dataPoints;
    if (pointsConfig.type === "auto") {
      dataPoints = Math.round(20 + ip.intensity * 3);
    } else if (pointsConfig.type === "fixed") {
      dataPoints = pointsConfig.value;
    } else {
      dataPoints = rng.int(pointsConfig.min, pointsConfig.max);
    }
    dataPoints = clamp(dataPoints, 2, 200);

    let allValues = [];

    for (let s = 0; s < numSections; s++) {
      const sectionPoints = Math.max(3, Math.floor(dataPoints / numSections));
      let values;

      if (mix && availableTypes.length > 1 && s > 0 && rng.chance(0.4)) {
        const type2 = rng.choice(availableTypes);
        const gen1 = waveformGenerators[waveType];
        const gen2 = waveformGenerators[type2];
        const v1 = gen1 ? gen1(sectionPoints, ip, interpolation) : genSine(sectionPoints, ip, interpolation);
        const v2 = gen2 ? gen2(sectionPoints, ip, interpolation) : genSine(sectionPoints, ip, interpolation);
        values = v1.map((v, i) => (v + v2[i]) / 2);
        values = rescaleWaveform(values, ip.minIntensity, ip.maxIntensity);
      } else {
        const gen = waveformGenerators[waveType];
        values = gen ? gen(sectionPoints, ip, interpolation) : waveformGenerators["正弦波"](sectionPoints, ip, interpolation);
      }

      if (s > 0) {
        const lastVal = allValues[allValues.length - 1];
        const firstVal = values[0];
        const blend = 3;
        for (let i = 0; i < blend && i < values.length; i++) {
          const t = i / blend;
          values[i] = lerp(lastVal, firstVal, t);
        }
      }

      allValues = allValues.concat(values);
    }

    allValues = rescaleWaveform(allValues, ip.minIntensity, ip.maxIntensity);

    const keyIndices = new Set();
    keyIndices.add(0);
    keyIndices.add(allValues.length - 1);
    for (let i = 1; i < allValues.length - 1; i++) {
      if (ip.shouldBeKeyframe()) keyIndices.add(i);
    }

    const dataStr = allValues.map((v, i) => makePoint(v, keyIndices.has(i))).join(",");

    const sectionLines = [];
    for (let s = 0; s < numSections; s++) {
      const mode = rng.int(0, 3);
      const onOff = 1;
      sectionLines.push(`${FREQ_A_MAP[freqA]},${FREQ_B_MAP[freqB]},${SECTION_TIME_MAP[durationIdx]},${mode},${onOff}`);
    }

    const content = [
      "Dungeonlab+pulse",
      `${restTime},${speedMult.toFixed(2)},${unknown}`,
      ...sectionLines,
      ":",
      dataStr,
      ":"
    ].join("\n");

    return content;
  }

  function enterPulseGen() {
    const overlay = document.getElementById("pulseGenOverlay");
    if (!overlay) return;
    overlay.style.display = "flex";
    document.body.classList.add("pulse-gen-mode");
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "pulsegen");
    window.history.replaceState({}, "", url.toString());
  }

  function exitPulseGen() {
    const overlay = document.getElementById("pulseGenOverlay");
    if (!overlay) return;
    overlay.style.display = "none";
    document.body.classList.remove("pulse-gen-mode");
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    window.history.replaceState({}, "", url.toString());
    stopAllAnimations();
  }

  function checkPulseGenMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "pulsegen") {
      enterPulseGen();
    }
  }

  let generatedWaveforms = [];
  let animationHandles = [];

  function stopAllAnimations() {
    for (const handle of animationHandles) {
      if (handle.cancel) handle.cancel();
    }
    animationHandles = [];
  }

  function getAvailableTypes() {
    const mode = document.getElementById("pulseTypeMode").value;
    if (mode === "all") return [...ALL_TYPES];
    if (mode === "category") {
      const checked = Array.from(document.querySelectorAll('#pulseCategoryList input[type="checkbox"]:checked')).map(cb => cb.value);
      if (checked.length === 0) return [...ALL_TYPES];
      const types = [];
      for (const cat of checked) {
        if (WAVE_CATEGORIES[cat]) types.push(...WAVE_CATEGORIES[cat]);
      }
      return types;
    }
    if (mode === "specific") {
      const checked = Array.from(document.querySelectorAll('#pulseTypeList input[type="checkbox"]:checked')).map(cb => cb.value);
      if (checked.length === 0) return [...ALL_TYPES];
      return checked;
    }
    return [...ALL_TYPES];
  }

  function getIntensityRange() {
    const preset = document.getElementById("pulseIntensityPreset").value;
    if (preset === "custom") {
      const minVal = parseFloat(document.getElementById("pulseMinIntensity").value) || 0;
      const maxVal = parseFloat(document.getElementById("pulseMaxIntensity").value) || 100;
      return { max: maxVal, min: minVal };
    }
    return INTENSITY_PRESETS[preset] || INTENSITY_PRESETS.full;
  }

  function getSectionsConfig() {
    const mode = document.getElementById("pulseSectionsMode").value;
    if (mode === "fixed") {
      return { type: "fixed", value: parseInt(document.getElementById("pulseFixedSections").value) || 2 };
    }
    const min = parseInt(document.getElementById("pulseMinSections").value) || 1;
    const max = parseInt(document.getElementById("pulseMaxSections").value) || 3;
    return { type: "range", min: Math.min(min, max), max: Math.max(min, max) };
  }

  function getPointsConfig() {
    const mode = document.getElementById("pulsePointsMode").value;
    if (mode === "auto") return { type: "auto" };
    if (mode === "fixed") {
      return { type: "fixed", value: parseInt(document.getElementById("pulseFixedPoints").value) || 30 };
    }
    const min = parseInt(document.getElementById("pulseMinPoints").value) || 10;
    const max = parseInt(document.getElementById("pulseMaxPoints").value) || 40;
    return { type: "range", min: Math.min(min, max), max: Math.max(min, max) };
  }

  function generateWaveforms() {
    stopAllAnimations();
    generatedWaveforms = [];

    const count = parseInt(document.getElementById("pulseCount").value) || 10;
    const intensity = parseInt(document.getElementById("pulseIntensity").value) || 5;
    const interpolation = document.getElementById("pulseInterpolation").value;
    const mix = document.getElementById("pulseMix").checked;
    const seedMode = document.getElementById("pulseSeedMode").value;
    const seed = seedMode === "fixed" ? parseInt(document.getElementById("pulseSeed").value) || 42 : null;

    if (seed !== null) rng = new SeededRandom(seed);
    else rng = new SeededRandom(Date.now());

    const intensityRange = getIntensityRange();
    let minVal = intensityRange.min;
    let maxVal = intensityRange.max;
    if (minVal > maxVal) [minVal, maxVal] = [maxVal, minVal];

    const ip = new IntensityParams(intensity, maxVal, minVal);
    const sectionsConfig = getSectionsConfig();
    const pointsConfig = getPointsConfig();
    const availableTypes = getAvailableTypes();

    for (let i = 0; i < count; i++) {
      const waveType = rng.choice(availableTypes);
      const content = generateWaveform(waveType, ip, interpolation, sectionsConfig, pointsConfig, mix, availableTypes);
      generatedWaveforms.push({ name: `${waveType}_${i + 1}`, type: waveType, content });
    }

    renderResults();
  }

  function renderResults() {
    const grid = document.getElementById("pulseGenGrid");
    const countEl = document.getElementById("pulseGenCount");
    if (!grid) return;

    countEl.textContent = `${generatedWaveforms.length} / 20`;

    if (generatedWaveforms.length === 0) {
      grid.innerHTML = `
        <div class="pulse-gen-empty">
          <svg class="pulse-gen-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <p>配置参数后点击「生成波形」</p>
          <p class="pulse-gen-empty-hint">最多生成 20 个波形</p>
        </div>`;
      return;
    }

    grid.innerHTML = "";
    generatedWaveforms.forEach((wf, idx) => {
      const card = document.createElement("div");
      card.className = "pulse-gen-card";
      card.innerHTML = `
        <div class="pulse-gen-card-title">${wf.name}</div>
        <div class="pulse-gen-card-canvas-wrap" id="pulseCardCanvas_${idx}"></div>
        <div class="pulse-gen-card-actions">
          <button class="pulse-gen-card-btn" data-action="copy" data-idx="${idx}">
            <svg class="ico ico-xs"><use href="#i-clipboard"/></svg> 复制
          </button>
          <button class="pulse-gen-card-btn" data-action="download" data-idx="${idx}">
            <svg class="ico ico-xs"><use href="#i-download"/></svg> 下载
          </button>
        </div>
      `;
      grid.appendChild(card);

      const canvasWrap = card.querySelector(`#pulseCardCanvas_${idx}`);
      renderMiniWaveform(canvasWrap, wf.content);
    });

    grid.querySelectorAll('.pulse-gen-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        const action = e.currentTarget.dataset.action;
        const wf = generatedWaveforms[idx];
        if (!wf) return;
        if (action === "copy") {
          navigator.clipboard.writeText(wf.content).then(() => {
            const original = e.currentTarget.innerHTML;
            e.currentTarget.innerHTML = '<svg class="ico ico-xs"><use href="#i-check"/></svg> 已复制';
            setTimeout(() => { e.currentTarget.innerHTML = original; }, 1500);
          });
        } else if (action === "download") {
          const blob = new Blob([wf.content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${wf.name}.pulse`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      });
    });
  }

  function renderMiniWaveform(container, content) {
    const canvas = document.createElement('canvas');
    canvas.className = 'pulse-gen-mini-canvas';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 80;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    let parsed = null;
    try {
      parsed = parseAndExpand(content);
    } catch (e) {
      return;
    }
    if (!parsed || !parsed.points || parsed.points.length === 0) return;

    const points = parsed.points;
    const padX = 4;
    const padY = 8;
    const graphW = w - padX * 2;
    const graphH = h - padY * 2;

    const scrollStepX = graphW * 0.015;
    let playheadIdx = 0;
    let lastTime = null;

    function draw(time) {
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      playheadIdx += delta * 0.03;
      if (playheadIdx >= points.length) playheadIdx = 0;

      ctx.clearRect(0, 0, w, h);

      const computedStyle = getComputedStyle(document.documentElement);
      const accentColor = computedStyle.getPropertyValue('--color-accent-purple').trim() || '#d4a5c9';
      const accentPink = computedStyle.getPropertyValue('--color-accent-pink').trim() || '#f2c4ce';
      const borderColor = computedStyle.getPropertyValue('--color-border').trim() || '#f0f0f0';
      const bgColor = computedStyle.getPropertyValue('--color-surface').trim() || '#ffffff';

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = padY + (graphH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(w - padX, y);
        ctx.stroke();
      }

      const playheadFixedX = padX + graphW * 0.5;
      const pointsVisible = Math.floor(graphW / scrollStepX);
      const centerIdx = Math.floor(playheadIdx);
      const startIdx = centerIdx - Math.floor(pointsVisible * 0.5);
      const endIdx = startIdx + pointsVisible;

      const barWidth = Math.max(1, scrollStepX * 0.6);

      ctx.fillStyle = accentColor;

      const gradient = ctx.createLinearGradient(padX, 0, w - padX, 0);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.15, accentColor);
      gradient.addColorStop(0.85, accentColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;

      for (let i = startIdx; i < endIdx; i++) {
        const idx = ((i % points.length) + points.length) % points.length;
        const x = padX + (i - startIdx) * scrollStepX;
        const barHeight = graphH * (points[idx].value / 100);
        const y = padY + graphH - barHeight;
        ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);
      }

      ctx.strokeStyle = accentPink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadFixedX, padY);
      ctx.lineTo(playheadFixedX, h - padY);
      ctx.stroke();

      const handle = requestAnimationFrame(draw);
      animationHandles.push({ cancel: () => cancelAnimationFrame(handle) });
    }

    requestAnimationFrame(draw);
  }

  function parseAndExpand(content) {
    const lines = content.trim().split('\n');
    if (lines[0] !== 'Dungeonlab+pulse') return null;

    const globalLine = lines[1];
    const globalParts = globalLine.split(',');

    let i = 2;
    const sections = [];
    while (i < lines.length && lines[i].trim() !== ':') {
      const parts = lines[i].split(',');
      sections.push({
        freqA: parseFloat(parts[0]),
        freqB: parseFloat(parts[1]),
        duration: parseFloat(parts[2]),
        mode: parseInt(parts[3]),
        onOff: parseInt(parts[4])
      });
      i++;
    }
    i++;

    const dataLine = lines[i];
    const pointStrs = dataLine.split(',');
    const points = pointStrs.map(s => {
      const [val, flag] = s.split('-');
      return { value: parseFloat(val), isKey: parseInt(flag) === 1 };
    });

    const expanded = [];
    for (const pt of points) {
      expanded.push(pt);
    }

    return { points: expanded, sections };
  }

  function initControls() {
    document.getElementById('exitPulseGenBtn')?.addEventListener('click', exitPulseGen);
    document.getElementById('pulseGenGenerateBtn')?.addEventListener('click', generateWaveforms);

    document.getElementById('pulseTypeMode')?.addEventListener('change', (e) => {
      const catList = document.getElementById('pulseCategoryList');
      const typeList = document.getElementById('pulseTypeList');
      catList.style.display = e.target.value === 'category' ? 'grid' : 'none';
      typeList.style.display = e.target.value === 'specific' ? 'grid' : 'none';
    });

    document.getElementById('pulseIntensity')?.addEventListener('input', (e) => {
      document.getElementById('pulseIntensityVal').textContent = e.target.value;
    });

    document.getElementById('pulseCount')?.addEventListener('input', (e) => {
      document.getElementById('pulseCountVal').textContent = e.target.value;
    });

    document.getElementById('pulseIntensityPreset')?.addEventListener('change', (e) => {
      document.getElementById('pulseCustomRange').style.display = e.target.value === 'custom' ? 'flex' : 'none';
    });

    document.getElementById('pulseSectionsMode')?.addEventListener('change', (e) => {
      document.getElementById('pulseSectionsRange').style.display = e.target.value === 'range' ? 'flex' : 'none';
      document.getElementById('pulseSectionsFixed').style.display = e.target.value === 'fixed' ? 'flex' : 'none';
    });

    document.getElementById('pulsePointsMode')?.addEventListener('change', (e) => {
      document.getElementById('pulsePointsFixed').style.display = e.target.value === 'fixed' ? 'flex' : 'none';
      document.getElementById('pulsePointsRange').style.display = e.target.value === 'range' ? 'flex' : 'none';
    });

    document.getElementById('pulseSeedMode')?.addEventListener('change', (e) => {
      document.getElementById('pulseSeedFixed').style.display = e.target.value === 'fixed' ? 'flex' : 'none';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initControls();
    checkPulseGenMode();
  });

  window.MarkdownPreview.enterPulseGen = enterPulseGen;
  window.MarkdownPreview.exitPulseGen = exitPulseGen;

})();
