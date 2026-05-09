import { describe, expect, it } from "vitest";
import { buildTimelinePayload } from "../src/core/builder.js";

describe("timeline builder", () => {
  it("builds payload fields from analyzer output", () => {
    const payload = buildTimelinePayload({
      analysis: {
        global_prompt: "cinematic medium shot",
        segments: [
          { prompt: "Subject stands still", weight: 1 },
          { prompt: "Subject turns left", weight: 1 },
        ],
      },
      durationSeconds: 10,
      fps: 24,
    });

    expect(payload.maxFrames).toBe(240);
    expect(payload.summary.segmentCount).toBe(2);
    expect(payload.timelineData.segments).toHaveLength(2);
    expect(payload.segmentLengths).toContain("|");
    expect(payload.localPrompts).toContain("|");
  });

  it("shifts frames away from a static opener toward later action", () => {
    const payload = buildTimelinePayload({
      analysis: {
        global_prompt: "cinematic medium shot",
        segments: [
          { prompt: "Subject stands still at the doorway", weight: 4 },
          { prompt: "Subject runs forward through the corridor", weight: 4 },
        ],
      },
      durationSeconds: 10,
      fps: 24,
    });

    expect(payload.maxFrames).toBe(240);
    expect(payload.timelineData.segments[0]?.length).toBe(103);
    expect(payload.timelineData.segments[1]?.length).toBe(137);
  });

  it("boosts action-heavy segment in multi-segment scenes", () => {
    const payload = buildTimelinePayload({
      analysis: {
        global_prompt: "cinematic close-up",
        segments: [
          { prompt: "Phone rests on desk in silence", weight: 4 },
          { prompt: "Camera tracks and rushes toward the screen", weight: 4 },
          { prompt: "Alert badge appears with slight glow", weight: 4 },
        ],
      },
      durationSeconds: 9,
      fps: 24,
    });

    expect(payload.maxFrames).toBe(216);
    expect(payload.timelineData.segments[1]?.length).toBeGreaterThan(payload.timelineData.segments[0]?.length ?? 0);
    expect(payload.timelineData.segments[1]?.length).toBeGreaterThan(payload.timelineData.segments[2]?.length ?? 0);
  });
});
