import { describe, expect, it } from "vitest";
import {
  buildRunningHubExecutionPlan,
  getRunningHubTargetDimensions,
  normalizeRunningHubWorkflowType,
  resolveRunningHubValidationInput,
} from "../src/core/runninghubWorkflow.js";
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

describe("runninghub workflow contract helpers", () => {
  it("normalizes unknown workflow type to ltx", () => {
    expect(normalizeRunningHubWorkflowType("unexpected")).toBe("ltx");
  });

  it("resolves ltx validation input with canonical fps when omitted", () => {
    const input = resolveRunningHubValidationInput({
      scene: "test scene",
      duration: "8",
      workflowType: "ltx",
    });

    expect(input.fps).toBe("24");
  });

  it("returns target dimensions per workflow", () => {
    expect(getRunningHubTargetDimensions("wan")).toEqual({ width: 720, height: 1280 });
    expect(getRunningHubTargetDimensions("ltx")).toEqual({ width: 576, height: 1024 });
  });

  it("builds ltx execution plan with exact frame semantics", () => {
    const plan = buildRunningHubExecutionPlan({
      payload,
      workflowType: "ltx",
      motionProfile: "balanced",
      uploadedImageFileName: "openapi/frame.jpeg",
      defaultWanWorkflowId: "wan-id",
      defaultLtxWorkflowId: "ltx-id",
    });

    const byKey = new Map(plan.nodeInfoList.map((item) => [`${item.nodeId}:${item.fieldName}`, item.fieldValue]));

    expect(plan.selectedWorkflowType).toBe("ltx");
    expect(plan.selectedWorkflowId).toBe("ltx-id");
    expect(plan.imageNodeValue).toBe("openapi/frame.jpeg");
    expect(byKey.get("17:value")).toBe(194);
    expect(byKey.get("39:max_frames")).toBe(194);
    expect(byKey.get("49:max_frames")).toBe(194);
    expect(byKey.get("58:max_frames")).toBe(194);
    expect(byKey.get("70:frame_rate")).toBe(24);
  });

  it("builds wan execution plan with inclusive frame semantics", () => {
    const wanPayload: TimelinePayload = {
      ...payload,
      summary: {
        ...payload.summary,
        fps: 16,
      },
      maxFrames: 240,
      timelineData: {
        segments: [
          { prompt: "segment a", length: 103, color: "#111111" },
          { prompt: "segment b", length: 137, color: "#222222" },
        ],
      },
    };
    const plan = buildRunningHubExecutionPlan({
      payload: wanPayload,
      workflowType: "wan",
      motionProfile: "balanced",
      uploadedImageFileName: "openapi/frame.jpg",
      defaultWanWorkflowId: "wan-id",
      defaultLtxWorkflowId: "ltx-id",
    });
    const byKey = new Map(plan.nodeInfoList.map((item) => [`${item.nodeId}:${item.fieldName}`, item.fieldValue]));

    expect(plan.selectedWorkflowType).toBe("wan");
    expect(plan.selectedWorkflowId).toBe("wan-id");
    expect(byKey.get("117:max_frames")).toBe(241);
    expect(byKey.get("129:max_frames")).toBe(241);
    expect(byKey.get("79:length")).toBe(241);
    expect(byKey.get("121:length")).toBe(241);
  });
});