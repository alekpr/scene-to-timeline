import { DEFAULT_SEGMENT_SECONDS } from "../domain/constants.js";

export function calcMaxFrames(durationSeconds: number, fps: number): number {
  return Math.round(durationSeconds * fps);
}

export function calcSegmentCount(durationSeconds: number, override?: number): number {
  if (override !== undefined && override > 0) {
    return override;
  }
  return Math.max(1, Math.round(durationSeconds / DEFAULT_SEGMENT_SECONDS));
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
