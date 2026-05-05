import { describe, it, expect } from "vitest";
import { analyzeScene } from "../src/core/analyzer.js";
import { validateAndPrepareInput } from "../src/core/validator.js";
import { buildTimelinePayload } from "../src/core/builder.js";
import { HACKER_CONTROL_ROOM_SCENE, HACKER_VOICEOVER } from "./fixtures/scenes.js";

describe.skipIf(!process.env.INTEGRATION_TEST)("integration: analyzeScene with real Anthropic API", () => {
  it("generates timeline segments from detailed scene description with transcript", async () => {
    const input = await validateAndPrepareInput({
      scene: HACKER_CONTROL_ROOM_SCENE,
      duration: "12",
      transcript: HACKER_VOICEOVER,
    });

    expect(input.sceneOverview).toContain("control room");
    expect(input.voiceoverTranscript).toContain("crisis");

    const analysis = await analyzeScene(input);

    expect(analysis.global_prompt).toBeDefined();
    expect(analysis.global_prompt.length).toBeGreaterThan(20);
    expect(analysis.segments).toBeDefined();
    expect(analysis.segments.length).toBeGreaterThan(0);

    analysis.segments.forEach((segment) => {
      expect(segment.prompt).toBeDefined();
      expect(segment.prompt.length).toBeGreaterThan(0);
      expect(segment.weight).toBeGreaterThanOrEqual(1);
      expect(segment.weight).toBeLessThanOrEqual(10);
    });

    const payload = buildTimelinePayload({
      analysis,
      durationSeconds: 12,
      fps: 24,
    });

    expect(payload.maxFrames).toBe(288);
    expect(payload.summary.segmentCount).toBe(analysis.segments.length);
    expect(payload.timelineData.segments).toHaveLength(analysis.segments.length);

    console.log("✅ Timeline Payload Generated:");
    console.log(JSON.stringify(payload, null, 2));
  });

  it("generates timeline from scene without transcript", async () => {
    const input = await validateAndPrepareInput({
      scene: HACKER_CONTROL_ROOM_SCENE,
      duration: "15",
    });

    expect(input.voiceoverTranscript).toBeUndefined();

    const analysis = await analyzeScene(input);

    expect(analysis.segments.length).toBeGreaterThan(0);

    const payload = buildTimelinePayload({
      analysis,
      durationSeconds: 15,
      fps: 24,
    });

    expect(payload.maxFrames).toBe(360);
    console.log("✅ Timeline (no transcript) generated successfully");
  });
});
