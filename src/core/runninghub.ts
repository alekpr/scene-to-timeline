import { type TimelinePayload } from "../domain/types.js";

export type MotionProfile = "fast" | "balanced" | "cinematic" | "template-like";

export const RUNNINGHUB_WORKFLOW_WIDTH = 720;
export const RUNNINGHUB_WORKFLOW_HEIGHT = 1280;

export interface RunningHubNodeInfo {
  nodeId: string;
  fieldName: string;
  fieldValue: string | number | boolean;
}

interface MotionProfilePreset {
  denoiseSteps: number;
  refineSteps: number;
  cfg: number;
  denoiseEndStep: number;
  refineStartStep: number;
  samplerName: string;
  scheduler: string;
}

const DEFAULT_MOTION_PROFILE: MotionProfile = "balanced";

const MOTION_PROFILE_PRESETS: Record<MotionProfile, MotionProfilePreset> = {
  fast: {
    denoiseSteps: 8,
    refineSteps: 8,
    cfg: 1,
    denoiseEndStep: 5,
    refineStartStep: 5,
    samplerName: "uni_pc",
    scheduler: "beta",
  },
  balanced: {
    denoiseSteps: 8,
    refineSteps: 8,
    cfg: 1,
    denoiseEndStep: 5,
    refineStartStep: 5,
    samplerName: "uni_pc",
    scheduler: "beta",
  },
  cinematic: {
    denoiseSteps: 8,
    refineSteps: 8,
    cfg: 1,
    denoiseEndStep: 5,
    refineStartStep: 5,
    samplerName: "uni_pc",
    scheduler: "beta",
  },
  "template-like": {
    denoiseSteps: 8,
    refineSteps: 8,
    cfg: 1,
    denoiseEndStep: 5,
    refineStartStep: 5,
    samplerName: "uni_pc",
    scheduler: "beta",
  },
};

export function normalizeMotionProfile(value: unknown): MotionProfile {
  if (value === "fast" || value === "balanced" || value === "cinematic" || value === "template-like") {
    return value;
  }

  return DEFAULT_MOTION_PROFILE;
}

export function getMotionProfilePreset(profile: MotionProfile): MotionProfilePreset {
  return MOTION_PROFILE_PRESETS[profile];
}

export function buildRunningHubNodeInfoList(
  payload: TimelinePayload,
  profile: MotionProfile,
  uploadedImageFileName?: string,
): RunningHubNodeInfo[] {
  const preset = getMotionProfilePreset(profile);
  const segmentLengthsCsv = payload.timelineData.segments.map((segment) => segment.length).join(", ");
  const timelineJson = JSON.stringify(payload.timelineData);
  const workflowFrameLength = payload.maxFrames + 1;

  const nodeInfoList: RunningHubNodeInfo[] = [
    { nodeId: "117", fieldName: "global_prompt", fieldValue: payload.globalPrompt },
    { nodeId: "117", fieldName: "max_frames", fieldValue: workflowFrameLength },
    { nodeId: "117", fieldName: "timeline_data", fieldValue: timelineJson },
    { nodeId: "117", fieldName: "local_prompts", fieldValue: payload.localPrompts },
    { nodeId: "117", fieldName: "segment_lengths", fieldValue: segmentLengthsCsv },
    { nodeId: "117", fieldName: "fps", fieldValue: payload.summary.fps },
    { nodeId: "129", fieldName: "global_prompt", fieldValue: payload.globalPrompt },
    { nodeId: "129", fieldName: "max_frames", fieldValue: workflowFrameLength },
    { nodeId: "129", fieldName: "timeline_data", fieldValue: timelineJson },
    { nodeId: "129", fieldName: "local_prompts", fieldValue: payload.localPrompts },
    { nodeId: "129", fieldName: "segment_lengths", fieldValue: segmentLengthsCsv },
    { nodeId: "129", fieldName: "fps", fieldValue: payload.summary.fps },
    { nodeId: "79", fieldName: "width", fieldValue: RUNNINGHUB_WORKFLOW_WIDTH },
    { nodeId: "79", fieldName: "height", fieldValue: RUNNINGHUB_WORKFLOW_HEIGHT },
    { nodeId: "79", fieldName: "length", fieldValue: workflowFrameLength },
    { nodeId: "121", fieldName: "width", fieldValue: RUNNINGHUB_WORKFLOW_WIDTH },
    { nodeId: "121", fieldName: "height", fieldValue: RUNNINGHUB_WORKFLOW_HEIGHT },
    { nodeId: "121", fieldName: "length", fieldValue: workflowFrameLength },
    { nodeId: "108", fieldName: "frame_rate", fieldValue: payload.summary.fps },
    { nodeId: "73", fieldName: "steps", fieldValue: preset.denoiseSteps },
    { nodeId: "73", fieldName: "cfg", fieldValue: preset.cfg },
    { nodeId: "73", fieldName: "sampler_name", fieldValue: preset.samplerName },
    { nodeId: "73", fieldName: "scheduler", fieldValue: preset.scheduler },
    { nodeId: "73", fieldName: "end_at_step", fieldValue: preset.denoiseEndStep },
    { nodeId: "83", fieldName: "steps", fieldValue: preset.refineSteps },
    { nodeId: "83", fieldName: "cfg", fieldValue: preset.cfg },
    { nodeId: "83", fieldName: "sampler_name", fieldValue: preset.samplerName },
    { nodeId: "83", fieldName: "scheduler", fieldValue: preset.scheduler },
    { nodeId: "83", fieldName: "start_at_step", fieldValue: preset.refineStartStep },
  ];

  if (uploadedImageFileName) {
    nodeInfoList.push({
      nodeId: "85",
      fieldName: "image",
      fieldValue: uploadedImageFileName.trim(),
    });
  }

  return nodeInfoList;
}