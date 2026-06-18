/**
 * Pure mission logic for the anti-snooze challenges (no DOM / no HA).
 * The mission-overlay renders these; ring-overlay only dismisses once a mission
 * reports "solved". Camera/motion/entity wiring lives in the component — here we
 * keep the deterministic bits (problem generation, thresholds, degradation).
 */
import type { MissionType } from "./types";

export interface MathProblem {
  question: string;
  answer: number;
}

/** Generate an arithmetic problem. Difficulty: "easy" | "medium" | "hard". */
export function makeMath(difficulty = "medium"): MathProblem {
  const r = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  if (difficulty === "easy") {
    const a = r(2, 9);
    const b = r(2, 9);
    return { question: `${a} + ${b}`, answer: a + b };
  }
  if (difficulty === "hard") {
    const a = r(6, 14);
    const b = r(6, 14);
    const c = r(2, 9);
    return { question: `${a} × ${b} + ${c}`, answer: a * b + c };
  }
  // medium
  const a = r(3, 12);
  const b = r(3, 12);
  return { question: `${a} × ${b}`, answer: a * b };
}

/** Magnitude of the change between two acceleration samples (for shake). */
export function shakeMagnitude(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

export const SHAKE_THRESHOLD = 18; // per-sample magnitude that counts as a shake
export const SHAKE_DEFAULT_COUNT = 12;

/**
 * Which mission to fall back to when `type` can't run on this device/setup
 * (no camera, no motion sensor, missing entity). Always terminates at "tap".
 */
export function degradeMission(type: MissionType): MissionType {
  // Sensor-dependent missions fall back to math; everything else to tap.
  return ["vision", "qr", "shake"].includes(type) ? "math" : "tap";
}

/** Missions that need an active mission UI (everything except none/tap). */
export function needsChallenge(type: MissionType): boolean {
  return type !== "none" && type !== "tap";
}
