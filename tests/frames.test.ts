import { describe, expect, it } from "vitest";
import { calcMaxFrames, calcSegmentCount, distributeFramesByWeights } from "../src/utils/frames.js";

describe("frames utility", () => {
  it("calculates max frames", () => {
    expect(calcMaxFrames(12, 24)).toBe(288);
  });

  it("uses minimum one segment", () => {
    expect(calcSegmentCount(0.8)).toBe(1);
  });

  it("distributes frames and preserves sum", () => {
    const lengths = distributeFramesByWeights([3, 2, 1], 120);
    expect(lengths.reduce((a, b) => a + b, 0)).toBe(120);
    expect(lengths[0]).toBeGreaterThan(lengths[2]);
  });
});
