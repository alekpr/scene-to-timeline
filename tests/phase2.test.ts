import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { validateAndPrepareInput } from "../src/core/validator.js";
import { buildTimelinePayload } from "../src/core/builder.js";
import { exportTimelineJSON } from "../src/core/export.js";
import { formatTimelinePreview } from "../src/core/preview.js";

describe("Phase 2 features", () => {
  const testOutputFile = "/tmp/test-timeline-output.json";

  afterEach(() => {
    if (existsSync(testOutputFile)) {
      unlinkSync(testOutputFile);
    }
  });

  it("accepts custom fps flag", async () => {
    const input = await validateAndPrepareInput({
      scene: "A test scene",
      duration: "10",
      fps: "30",
    });

    expect(input.fps).toBe(30);

    const payload = buildTimelinePayload({
      analysis: {
        global_prompt: "Test",
        segments: [{ prompt: "Seg1", weight: 1 }],
      },
      durationSeconds: 10,
      fps: input.fps,
    });

    expect(payload.maxFrames).toBe(300);
  });

  it("accepts custom segments flag", async () => {
    const input = await validateAndPrepareInput({
      scene: "A test scene",
      duration: "10",
      segments: "5",
    });

    expect(input.requestedSegmentCount).toBe(5);
  });

  it("exports timeline to JSON file", async () => {
    const payload = buildTimelinePayload({
      analysis: {
        global_prompt: "Test global prompt",
        segments: [
          { prompt: "Seg1", weight: 1 },
          { prompt: "Seg2", weight: 1 },
        ],
      },
      durationSeconds: 10,
      fps: 24,
    });

    await exportTimelineJSON(payload, testOutputFile);

    expect(existsSync(testOutputFile)).toBe(true);
    const content = readFileSync(testOutputFile, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed.globalPrompt).toBe("Test global prompt");
    expect(parsed.timelineData.segments).toHaveLength(2);
  });

  it("generates preview with visual timeline", () => {
    const payload = buildTimelinePayload({
      analysis: {
        global_prompt: "Test",
        segments: [
          { prompt: "Standing still", weight: 1 },
          { prompt: "Walking forward", weight: 2 },
        ],
      },
      durationSeconds: 12,
      fps: 24,
    });

    const preview = formatTimelinePreview(payload);

    expect(preview).toContain("TIMELINE PREVIEW");
    expect(preview).toContain("Seg 1:");
    expect(preview).toContain("Seg 2:");
    expect(preview).toContain("Standing still");
    expect(preview).toContain("Walking forward");
    expect(preview).toContain("█");
  });
});
