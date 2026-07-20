// Короткие синтезированные звуки через Web Audio: без файлов и внешних запросов.
// Все вызовы безопасны: если звук выключен или AudioContext недоступен, тишина.

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
      masterGain.gain.value = 0.9;
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

function output(): AudioNode | null {
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

function playTones(steps: ToneStep[], startDelay = 0) {
  const ctx = context();
  const dest = output();

  if (!ctx || !dest) {
    return;
  }

  let at = ctx.currentTime + startDelay;

  for (const step of steps) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = step.type ?? "triangle";
    oscillator.frequency.setValueAtTime(step.frequency, at);

    if (step.glideTo !== undefined) {
      oscillator.frequency.linearRampToValueAtTime(step.glideTo, at + step.duration);
    }

    const volume = step.volume ?? 0.35;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + step.duration);
    oscillator.connect(gain);
    gain.connect(dest);
    oscillator.start(at);
    oscillator.stop(at + step.duration + 0.03);
    at += step.duration * 0.86;
  }
}

// Глухой удар по мячу: короткий низкий «бум» с быстрым спадом высоты.
export function playKick(delaySeconds = 0) {
  playTones([{ frequency: 160, duration: 0.12, glideTo: 55, volume: 0.5, type: "sine" }], delaySeconds);
}

export function playResult(kind: ResultKind, delaySeconds = 0) {
  if (kind === "correct") {
    // Радостная восходящая фанфара - «сейв».
    playTones(
      [
        { frequency: 523, duration: 0.12, volume: 0.32 },
        { frequency: 659, duration: 0.12, volume: 0.32 },
        { frequency: 784, duration: 0.12, volume: 0.32 },
        { frequency: 1047, duration: 0.3, volume: 0.34 }
      ],
      delaySeconds
    );
  } else if (kind === "almost") {
    playTones(
      [
        { frequency: 494, duration: 0.14, volume: 0.3 },
        { frequency: 587, duration: 0.2, volume: 0.3 }
      ],
      delaySeconds
    );
  } else {
    // Огорчение трибун - нисходящее «оу-у», как несостоявшийся сейв.
    playTones([{ frequency: 392, duration: 0.55, glideTo: 147, volume: 0.34, type: "sawtooth" }], delaySeconds);
    playTones([{ frequency: 196, duration: 0.55, glideTo: 82, volume: 0.22, type: "sine" }], delaySeconds + 0.03);
  }
}

// Короткая фанфара нового бейджа.
export function playBadge() {
  playTones([
    { frequency: 523, duration: 0.12, volume: 0.3 },
    { frequency: 659, duration: 0.12, volume: 0.3 },
    { frequency: 784, duration: 0.12, volume: 0.3 },
    { frequency: 1047, duration: 0.3, volume: 0.32 }
  ]);
}

// Свисток на старте реакции.
export function playWhistle() {
  playTones([
    { frequency: 1760, duration: 0.1, volume: 0.18, type: "square" },
    { frequency: 2093, duration: 0.16, volume: 0.18, type: "square" }
  ]);
}
