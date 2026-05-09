import { DEFAULT_SEGMENT_SECONDS } from "../domain/constants.js";

const TRANSITION_CUE_PATTERN =
  /\b(then|next|after\s+that|suddenly|meanwhile|before|when|as|cut\s+to|eventually|finally)\b|แล้ว|จากนั้น|ต่อมา|ทันใดนั้น|ทันที|ก่อนจะ|ขณะที่|เมื่อ|ตัดไปที่/gi;
const STATIC_MOTION_PATTERN =
  /\b(sits?|stands?|waits?|watches?|listens?|rests?|silent|silence|still|motionless|calm)\b|นิ่ง|เงียบ|ยืนอยู่|นั่งอยู่/gi;
const DYNAMIC_MOTION_PATTERN =
  /\b(runs?|jumps?|accelerates?|crashes?|explodes?|swings?|throws?|collides?|sprints?|dives?|rolls?|lunges?|rushes?|spins?|chases?|dodges?)\b|วิ่ง|กระโดด|พุ่ง|ชน|ระเบิด|ไล่ล่า/gi;
const CAMERA_MOTION_PATTERN =
  /\b(cut\s+to|pans?|zooms?|push(?:es)?\s+in|tracks?|tracking\s+shot|dolly|crane)\b|แพนกล้อง|ซูม|ดอลลี่|เครน/gi;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countRegexMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function estimateMotionIntensity(sceneOverview: string): number {
  const dynamicHits = countRegexMatches(sceneOverview, DYNAMIC_MOTION_PATTERN);
  const cameraHits = countRegexMatches(sceneOverview, CAMERA_MOTION_PATTERN);
  const staticHits = countRegexMatches(sceneOverview, STATIC_MOTION_PATTERN);

  const intensity = 1 + dynamicHits * 0.14 + cameraHits * 0.08 - staticHits * 0.05;
  return clamp(intensity, 0.85, 1.35);
}

export function calcMaxFrames(durationSeconds: number, fps: number): number {
  return Math.round(durationSeconds * fps);
}

export function calcSegmentCount(durationSeconds: number, override?: number): number {
  if (override !== undefined && override > 0) {
    return override;
  }
  return Math.max(1, Math.round(durationSeconds / DEFAULT_SEGMENT_SECONDS));
}

export function inferSegmentCountFromScene(
  sceneOverview: string,
  durationSeconds: number,
): number {
  const baseCount = calcSegmentCount(durationSeconds);
  const trimmed = sceneOverview.trim();
  if (!trimmed) {
    return baseCount;
  }

  const transitionHits = countRegexMatches(trimmed, TRANSITION_CUE_PATTERN);
  const sentenceCount = trimmed
    .split(/[.!?\n]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  const transitionBoost = Math.min(4, transitionHits);
  const sentenceBoost = Math.min(3, Math.floor(Math.max(0, sentenceCount - 1) / 2));
  const motionBias = estimateMotionIntensity(trimmed);
  const suggestedCount = Math.round((baseCount + transitionBoost + sentenceBoost) * motionBias);

  // Keep cinematic pacing around 2-5 seconds per segment.
  const rhythmCap = Math.max(1, Math.floor(durationSeconds / 2));
  return clamp(suggestedCount, 1, rhythmCap);
}

export function distributeFramesByWeights(
  weights: number[],
  maxFrames: number,
): number[] {
  if (weights.length === 0) {
    return [];
  }

  const normalizedWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1));
  const totalWeight = normalizedWeights.reduce((sum, w) => sum + w, 0);

  const raw = normalizedWeights.map((w) => (w / totalWeight) * maxFrames);
  const base = raw.map((value) => Math.floor(value));
  let remainder = maxFrames - base.reduce((sum, value) => sum + value, 0);

  const sortedFractionalIndexes = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac)
    .map((item) => item.index);

  let cursor = 0;
  while (remainder > 0) {
    const targetIndex = sortedFractionalIndexes[cursor % sortedFractionalIndexes.length];
    base[targetIndex] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return base;
}
