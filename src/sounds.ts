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

// Несколько тонов одновременно (аккорд).
function playChord(frequencies: number[], duration: number, volume: number, startDelay = 0) {
  const ctx = context();
  const out = dest();

  if (!ctx || !out) {
    return;
  }

  const at = ctx.currentTime + startDelay;

  for (const frequency of frequencies) {
    playTone(ctx, out, { frequency, duration, volume, type: "triangle" }, at);
  }
}

// Мягкий шумовой «свелл» - основа для аплодисментов/оваций.
function playCrowdSwell(delaySeconds: number, duration: number, peakVolume: number) {
  const ctx = context();
  const out = dest();

  if (!ctx || !out) {
    return;
  }

  const at = ctx.currentTime + delaySeconds;
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  filter.Q.value = 0.6;
  const gain = ctx.createGain();
  // Плавный подъём и спад - как нарастающие аплодисменты.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(peakVolume, at + duration * 0.3);
  gain.gain.linearRampToValueAtTime(0.0001, at + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(at);
  source.stop(at + duration + 0.02);
}

// Глухой удар по мячу: короткий низкий «бум».
export function playKick(delaySeconds = 0) {
  playSequence([{ frequency: 170, duration: 0.13, glideTo: 52, volume: 0.6, type: "sine" }], delaySeconds);
}

export function playResult(kind: ResultKind, delaySeconds = 0) {
  if (kind === "correct") {
    // Сейв: восходящее «та-да» + овации трибун.
    playSequence(
      [
        { frequency: 523, duration: 0.12, volume: 0.5, type: "triangle" },
        { frequency: 784, duration: 0.12, volume: 0.5, type: "triangle" }
      ],
      delaySeconds
    );
    playChord([523, 659, 784, 1047], 0.6, 0.28, delaySeconds + 0.2);
    playCrowdSwell(delaySeconds + 0.15, 0.9, 0.5);
  } else if (kind === "almost") {
    // Почти: короткое ободряющее двузвучие.
    playSequence(
      [
        { frequency: 494, duration: 0.14, volume: 0.42, type: "triangle" },
        { frequency: 622, duration: 0.22, volume: 0.42, type: "triangle" }
      ],
      delaySeconds
    );
    playCrowdSwell(delaySeconds + 0.1, 0.5, 0.22);
  } else {
    // Гол: разочарованное «оу-у» трибун, нисходящее.
    playSequence([{ frequency: 415, duration: 0.6, glideTo: 155, volume: 0.5, type: "triangle" }], delaySeconds);
    playSequence([{ frequency: 208, duration: 0.6, glideTo: 78, volume: 0.32, type: "sine" }], delaySeconds + 0.02);
  }
}

// Короткая фанфара нового бейджа.
export function playBadge() {
  playSequence([
    { frequency: 523, duration: 0.12, volume: 0.42, type: "triangle" },
    { frequency: 659, duration: 0.12, volume: 0.42, type: "triangle" },
    { frequency: 784, duration: 0.12, volume: 0.42, type: "triangle" },
    { frequency: 1047, duration: 0.3, volume: 0.45, type: "triangle" }
  ]);
}

// Свисток на старте реакции: мягкий, без резкого «квадрата».
export function playWhistle() {
  playSequence([
    { frequency: 1760, duration: 0.1, volume: 0.3, type: "triangle" },
    { frequency: 2093, duration: 0.16, volume: 0.3, type: "triangle" }
  ]);
}
