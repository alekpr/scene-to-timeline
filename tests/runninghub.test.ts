import { describe, expect, it } from "vitest";
import {
  buildRunningHubNodeInfoList,
  getMotionProfilePreset,
  normalizeMotionProfile,
} from "../src/core/runninghub.js";
import { type TimelinePayload } from "../src/domain/types.js";

const payload: TimelinePayload = {
  globalPrompt: "cinematic control room",
  localPrompts: "stand still | run forward",
  segmentLengths: "103 | 137",
  maxFrames: 240,
  timelineData: {
    segments: [
      { prompt: "stand still", length: 103, color: "#111111" },
      { prompt: "run forward", length: 137, color: "#222222" },
    ],
  },
  summary: {
    durationSeconds: 10,
    fps: 16,
    segmentCount: 2,
  },
};

describe("runninghub helpers", () => {
  it("normalizes unknown profiles to balanced", () => {
    expect(normalizeMotionProfile("unexpected")).toBe("balanced");
  });

  it("accepts template-like profile label", () => {
    expect(normalizeMotionProfile("template-like")).toBe("template-like");
  });

  it("returns cinematic sampler preset", () => {
    expect(getMotionProfilePreset("cinematic")).toEqual({
      denoiseSteps: 8,
      refineSteps: 8,
      cfg: 1,
      denoiseEndStep: 5,
      refineStartStep: 5,
      samplerName: "uni_pc",
      scheduler: "beta",
    });
  });

  it("maps payload frames with workflow-inclusive length and injects profile sampler fields", () => {
    const nodeInfoList = buildRunningHubNodeInfoList(payload, "fast", "openapi/frame.jpg");
    const byKey = new Map(nodeInfoList.map((item) => [`${item.nodeId}:${item.fieldName}`, item.fieldValue]));

    expect(byKey.get("117:max_frames")).toBe(241);
    expect(byKey.get("129:max_frames")).toBe(241);
    expect(byKey.get("117:fps")).toBe(16);
    expect(byKey.get("129:fps")).toBe(16);
    expect(byKey.get("79:width")).toBe(720);
    expect(byKey.get("79:height")).toBe(1280);
    expect(byKey.get("79:length")).toBe(241);
    expect(byKey.get("121:width")).toBe(720);
    expect(byKey.get("121:height")).toBe(1280);
    expect(byKey.get("121:length")).toBe(241);
    expect(byKey.get("108:frame_rate")).toBe(16);
    expect(byKey.get("73:steps")).toBe(8);
    expect(byKey.get("73:cfg")).toBe(1);
    expect(byKey.get("73:sampler_name")).toBe("uni_pc");
    expect(byKey.get("73:scheduler")).toBe("beta");
    expect(byKey.get("73:end_at_step")).toBe(5);
    expect(byKey.get("83:steps")).toBe(8);
    expect(byKey.get("83:cfg")).toBe(1);
    expect(byKey.get("83:sampler_name")).toBe("uni_pc");
    expect(byKey.get("83:scheduler")).toBe("beta");
    expect(byKey.get("83:start_at_step")).toBe(5);
    expect(byKey.get("85:image")).toBe("openapi/frame.jpg");
  });
});