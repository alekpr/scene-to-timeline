import { describe, expect, it } from "vitest";
import {
  calcMaxFrames,
  calcSegmentCount,
  distributeFramesByWeights,
  estimateMotionIntensity,
  inferSegmentCountFromScene,
} from "../src/utils/frames.js";

describe("frames utility", () => {
  it("calculates max frames", () => {
    expect(calcMaxFrames(12, 24)).toBe(288);
  });

  it("uses minimum one segment", () => {
    expect(calcSegmentCount(0.8)).toBe(1);
  });

  it("infers baseline count for static scene", () => {
    const count = inferSegmentCountFromScene("A man sits in silence by the window", 12);
    expect(count).toBe(4);
  });

  it("infers higher count for multi-transition scene", () => {
    const count = inferSegmentCountFromScene(
      "He sits. Then he stands. Next he opens the door. Suddenly he runs outside.",
      12,
    );
    expect(count).toBeGreaterThan(4);
  });

  it("supports Thai transition cues", () => {
    const count = inferSegmentCountFromScene(
      "ชายคนหนึ่งนั่งอยู่ แล้วลุกขึ้น จากนั้นเดินไปที่ประตู ทันใดนั้นฝนตก",
      12,
    );
    expect(count).toBeGreaterThan(4);
  });

  it("rates dynamic scenes as more motion-intense than static ones", () => {
    const staticScore = estimateMotionIntensity("A man sits still in silence by the window");
    const dynamicScore = estimateMotionIntensity(
      "A stunt driver accelerates, swerves, crashes through glass, and the camera pushes in",
    );

    expect(dynamicScore).toBeGreaterThan(staticScore);
  });

  it("biases action scenes toward more segments when duration is equal", () => {
    const staticCount = inferSegmentCountFromScene(
      "A man sits still in silence by the window watching the rain.",
      12,
    );
    const actionCount = inferSegmentCountFromScene(
      "A stunt driver accelerates, swerves, crashes through glass, then dives out as the camera tracks left.",
      12,
    );

    expect(actionCount).toBeGreaterThan(staticCount);
  });

  it("clamps inferred count for short duration", () => {
    const count = inferSegmentCountFromScene(
      "Then next suddenly after that cut to eventually finally",
      2,
    );
    expect(count).toBe(1);
  });

  it("distributes frames and preserves sum", () => {
    const lengths = distributeFramesByWeights([3, 2, 1], 120);
    expect(lengths.reduce((a, b) => a + b, 0)).toBe(120);
    expect(lengths[0]).toBeGreaterThan(lengths[2]);
  });

  it("keeps explicit override precedence", () => {
    expect(calcSegmentCount(12, 2)).toBe(2);
  });
});
