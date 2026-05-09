import { describe, expect, it } from "vitest";
import {
  buildLTXRunningHubNodeInfoList,
  getLTXMotionProfilePreset,
  LTX_WORKFLOW_HEIGHT,
  LTX_WORKFLOW_WIDTH,
  normalizeLTXMotionProfile,
} from "../src/core/ltxRunninghub.js";
import { type TimelinePayload } from "../src/domain/types.js";

const payload: TimelinePayload = {
  globalPrompt: "hacker control room",
  localPrompts: "segment a | segment b | segment c | segment d",
  segmentLengths: "38, 58, 58, 39",
  maxFrames: 193,
  timelineData: {
    segments: [
      { prompt: "segment a", length: 38, color: "#111111" },
      { prompt: "segment b", length: 58, color: "#222222" },
      { prompt: "segment c", length: 58, color: "#333333" },
      { prompt: "segment d", length: 39, color: "#444444" },
    ],
  },
  summary: {
    durationSeconds: 8,
    fps: 24,
    segmentCount: 4,
  },
};

describe("ltx runninghub helpers", () => {
  it("normalizes unknown profiles to balanced", () => {
    expect(normalizeLTXMotionProfile("unexpected")).toBe("balanced");
  });

  it("accepts template-like profile", () => {
    expect(normalizeLTXMotionProfile("template-like")).toBe("template-like");
  });

  it("returns baseline three-stage preset for balanced", () => {
    expect(getLTXMotionProfilePreset("balanced")).toEqual({
      stage1Cfg: 3.5,
      stage2Cfg: 3,
      stage3Cfg: 2.5,
      stage1Sigmas: "1.0, 0.9875, 0.975, 0.909, 0.85, 0.0",
      stage2Sigmas: "0.85, 0.725, 0.421, 0.0",
      stage3Sigmas: "0.421, 0.2, 0.0",
      imageStrength: 0.65,
      samplerName: "euler_ancestral_cfg_pp",
    });
  });

  it("returns stronger cinematic preset than fast", () => {
    expect(getLTXMotionProfilePreset("cinematic")).toEqual({
      stage1Cfg: 4,
      stage2Cfg: 3.5,
      stage3Cfg: 3,
      stage1Sigmas: "1.0, 0.992, 0.984, 0.968, 0.94, 0.9, 0.85, 0.0",
      stage2Sigmas: "0.85, 0.78, 0.68, 0.55, 0.421, 0.0",
      stage3Sigmas: "0.421, 0.32, 0.24, 0.16, 0.0",
      imageStrength: 0.58,
      samplerName: "euler_ancestral_cfg_pp",
    });

    const fastPreset = getLTXMotionProfilePreset("fast");
    const cinematicPreset = getLTXMotionProfilePreset("cinematic");
    expect(cinematicPreset.stage1Cfg).toBeGreaterThan(fastPreset.stage1Cfg);
    expect(cinematicPreset.imageStrength).toBeLessThan(fastPreset.imageStrength);
  });

  it("returns template-like preset aligned to all-in-one baseline style", () => {
    expect(getLTXMotionProfilePreset("template-like")).toEqual({
      stage1Cfg: 3.2,
      stage2Cfg: 3,
      stage3Cfg: 2.7,
      stage1Sigmas: "1.0, 0.98, 0.92, 0.85, 0.0",
      stage2Sigmas: "0.85, 0.7, 0.5, 0.0",
      stage3Sigmas: "0.5, 0.3, 0.0",
      imageStrength: 0.62,
      samplerName: "euler",
    });
  });

  it("maps payload to ltx nodes with profile-aware cinematic defaults", () => {
    const nodeInfoList = buildLTXRunningHubNodeInfoList(payload, "fast", "openapi/frame.jpeg");
    const byKey = new Map(nodeInfoList.map((item) => [`${item.nodeId}:${item.fieldName}`, item.fieldValue]));

    expect(byKey.get("5:image")).toBe("openapi/frame.jpeg");
    expect(byKey.get("11:value")).toBe(24);
    expect(byKey.get("13:value")).toBe(LTX_WORKFLOW_WIDTH);
    expect(byKey.get("15:value")).toBe(LTX_WORKFLOW_HEIGHT);
    expect(byKey.get("17:value")).toBe(194);
    expect(byKey.get("39:max_frames")).toBe(194);
    expect(byKey.get("49:max_frames")).toBe(194);
    expect(byKey.get("58:max_frames")).toBe(194);
    expect(byKey.get("39:fps")).toBe(24);
    expect(byKey.get("49:fps")).toBe(24);
    expect(byKey.get("58:fps")).toBe(24);
    expect(byKey.get("40:frame_rate")).toBe(24);
    expect(byKey.get("50:frame_rate")).toBe(24);
    expect(byKey.get("59:frame_rate")).toBe(24);
    expect(byKey.get("41:cfg")).toBe(3);
    expect(byKey.get("51:cfg")).toBe(2.7);
    expect(byKey.get("60:cfg")).toBe(2.3);
    expect(byKey.get("43:sigmas")).toBe("1.0, 0.95, 0.85, 0.0");
    expect(byKey.get("53:sigmas")).toBe("0.85, 0.55, 0.0");
    expect(byKey.get("62:sigmas")).toBe("0.55, 0.2, 0.0");
    expect(byKey.get("28:strength")).toBe(0.72);
    expect(byKey.get("44:sampler_name")).toBe("euler_ancestral_cfg_pp");
    expect(byKey.get("70:frame_rate")).toBe(24);
  });

  it("maps template-like profile with euler sampler and moderate strength", () => {
    const nodeInfoList = buildLTXRunningHubNodeInfoList(payload, "template-like", "openapi/frame.jpeg");
    const byKey = new Map(nodeInfoList.map((item) => [`${item.nodeId}:${item.fieldName}`, item.fieldValue]));

    expect(byKey.get("28:strength")).toBe(0.62);
    expect(byKey.get("41:cfg")).toBe(3.2);
    expect(byKey.get("51:cfg")).toBe(3);
    expect(byKey.get("60:cfg")).toBe(2.7);
    expect(byKey.get("43:sigmas")).toBe("1.0, 0.98, 0.92, 0.85, 0.0");
    expect(byKey.get("53:sigmas")).toBe("0.85, 0.7, 0.5, 0.0");
    expect(byKey.get("62:sigmas")).toBe("0.5, 0.3, 0.0");
    expect(byKey.get("44:sampler_name")).toBe("euler");
  });
});