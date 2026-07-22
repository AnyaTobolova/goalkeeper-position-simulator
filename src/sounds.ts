// Короткие синтезированные звуки через Web Audio: без файлов и внешних запросов.
// Все вызовы безопасны: если звук выключен или AudioContext недоступен, тишина.
// Огибающие плавные (мягкая атака и затухание), чтобы не было щелчков.

import type { ResultKind } from "./domain/types";

const soundKey = "goalkeeper-sim:sound-on";

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;

export function isSoundOn() {
  // По умолчанию звук выключен: включается кнопкой-динамиком в шапке.
  return localStorage.getItem(soundKey) === "on";
}

export function setSoundOn(on: boolean) {
  localStorage.setItem(soundKey, on ? "on" : "off");
}

function context(): AudioContext | null {
  if (!isSoundOn()) {
    return null;
  }

  try {
    if (!audioContext) {
      audioContext = new AudioContext();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    return audioContext;
  } catch {
    return null;
  }
}

function dest(): AudioNode | null {
  const ctx = context();
  return ctx ? masterGain ?? ctx.destination : null;
}

type ToneStep = {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  glideTo?: number;
};

// Один тон с мягкой атакой и плавным затуханием (без щелчка на старте/стопе).
function playTone(ctx: AudioContext, out: AudioNode, step: ToneStep, at: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = step.type ?? "sine";
  oscillator.frequency.setValueAtTime(step.frequency, at);

  if (step.glideTo !== undefined) {
    oscillator.frequency.linearRampToValueAtTime(step.glideTo, at + step.duration);
  }

  const volume = step.volume ?? 0.4;
  const attack = 0.02;
  const release = Math.min(0.12, step.duration * 0.5);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + attack);
  gain.gain.setValueAtTime(volume, at + Math.max(attack, step.duration - release));
  gain.gain.linearRampToValueAtTime(0.0001, at + step.duration);

  oscillator.connect(gain);
  gain.connect(out);
  oscillator.start(at);
  oscillator.stop(at + step.duration + 0.02);
}

function playSequence(steps: ToneStep[], startDelay = 0, gap = 0.86) {
  const ctx = context();
  const out = dest();

  if (!ctx || !out) {
    return;
  }

  let at = ctx.currentTime + startDelay;

  for (const step of steps) {
    playTone(ctx, out, step, at);
    at += step.duration * gap;
  }
}


// Тоны с явным смещением по времени (для перекрывающихся аккордов-фанфар).
function playTonesAt(steps: Array<ToneStep & { atOffset: number }>, startDelay = 0) {
  const ctx = context();
  const out = dest();

  if (!ctx || !out) {
    return;
  }

  const base = ctx.currentTime + startDelay;

  for (const step of steps) {
    playTone(ctx, out, step, base + step.atOffset);
  }
}

// Короткий шумовой «щелчок» - для удара по мячу.
function clap(at: number, freq: number, v: number) {
  const ctx = context();
  const out = dest();

  if (!ctx || !out) {
    return;
  }

  const len = Math.floor(ctx.sampleRate * 0.07);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(v, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);

  source.connect(bp);
  bp.connect(gain);
  gain.connect(out);
  source.start(at);
  source.stop(at + 0.09);
}

// Удар по мячу: «щелчок + тело» (выбранный вариант).
export function playKick(delaySeconds = 0) {
  const ctx = context();

  if (ctx) {
    clap(ctx.currentTime + delaySeconds, 2600, 0.4);
  }

  playSequence([{ frequency: 150, duration: 0.1, glideTo: 60, volume: 0.5, type: "sine" }], delaySeconds);
}

export function playResult(kind: ResultKind, delaySeconds = 0) {
  if (kind === "correct") {
    // Сейв: победная фанфара (выбранный вариант).
    playTonesAt(
      [
        { frequency: 523, atOffset: 0, duration: 0.34, volume: 0.42, type: "triangle" },
        { frequency: 659, atOffset: 0.12, duration: 0.34, volume: 0.42, type: "triangle" },
        { frequency: 784, atOffset: 0.24, duration: 0.34, volume: 0.42, type: "triangle" },
        { frequency: 1047, atOffset: 0.36, duration: 0.34, volume: 0.42, type: "triangle" }
      ],
      delaySeconds
    );
  } else if (kind === "almost") {
    // Почти: короткая ободряющая версия фанфары.
    playTonesAt(
      [
        { frequency: 523, atOffset: 0, duration: 0.28, volume: 0.4, type: "triangle" },
        { frequency: 784, atOffset: 0.12, duration: 0.3, volume: 0.4, type: "triangle" }
      ],
      delaySeconds
    );
  } else {
    // Гол: грустная труба «ва-ва-вааа» (выбранный вариант).
    playTonesAt(
      [
        { frequency: 392, glideTo: 392 * 0.94, atOffset: 0, duration: 0.3, volume: 0.4, type: "sawtooth" },
        { frequency: 349, glideTo: 349 * 0.94, atOffset: 0.18, duration: 0.3, volume: 0.4, type: "sawtooth" },
        { frequency: 294, glideTo: 294 * 0.94, atOffset: 0.36, duration: 0.3, volume: 0.4, type: "sawtooth" },
        { frequency: 262, glideTo: 180, atOffset: 0.54, duration: 0.5, volume: 0.42, type: "sawtooth" }
      ],
      delaySeconds
    );
  }
}

// Новый бейдж: та же фанфара, что и на сейв.
export function playBadge() {
  playTonesAt([
    { frequency: 523, atOffset: 0, duration: 0.34, volume: 0.42, type: "triangle" },
    { frequency: 659, atOffset: 0.12, duration: 0.34, volume: 0.42, type: "triangle" },
    { frequency: 784, atOffset: 0.24, duration: 0.34, volume: 0.42, type: "triangle" },
    { frequency: 1047, atOffset: 0.36, duration: 0.34, volume: 0.44, type: "triangle" }
  ]);
}

// Свисток на старте реакции: длинный судейский (выбранный вариант).
export function playWhistle() {
  playSequence([{ frequency: 2100, duration: 0.4, volume: 0.28, type: "square" }]);
}
