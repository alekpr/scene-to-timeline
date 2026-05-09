import { type TimelinePayload } from "../domain/types.js";
import { type MotionProfile, type RunningHubNodeInfo } from "./runninghub.js";

export const LTX_WORKFLOW_WIDTH = 576;
export const LTX_WORKFLOW_HEIGHT = 1024;
export const LTX_WORKFLOW_FPS = 24;
export const LTX_EPSILON = 0.001;
export const LTX_TIME_UNITS = "frames";
export const LTX_DEFAULT_SEED = -499897673352479;
export const LTX_PREPROCESS_COMPRESSION = 18;
export const LTX_IMAGE_STRENGTH = 0.7;
export const LTX_SAMPLER_NAME = "euler_ancestral_cfg_pp";

interface LTXMotionProfilePreset {
  stage1Cfg: number;
  stage2Cfg: number;
  stage3Cfg: number;
  stage1Sigmas: string;
  stage2Sigmas: string;
  stage3Sigmas: string;
  imageStrength: number;
  samplerName: string;
}

const DEFAULT_LTX_MOTION_PROFILE: MotionProfile = "balanced";

const DEFAULT_LTX_MOTION_PRESET: LTXMotionProfilePreset = {
  stage1Cfg: 3.5,
  stage2Cfg: 3,
  stage3Cfg: 2.5,
  stage1Sigmas: "1.0, 0.9875, 0.975, 0.909, 0.85, 0.0",
  stage2Sigmas: "0.85, 0.725, 0.421, 0.0",
  stage3Sigmas: "0.421, 0.2, 0.0",
  imageStrength: 0.65,
  samplerName: LTX_SAMPLER_NAME,
};

const LTX_MOTION_PROFILE_PRESETS: Record<MotionProfile, LTXMotionProfilePreset> = {
  fast: {
    stage1Cfg: 3,
    stage2Cfg: 2.7,
    stage3Cfg: 2.3,
    stage1Sigmas: "1.0, 0.95, 0.85, 0.0",
    stage2Sigmas: "0.85, 0.55, 0.0",
    stage3Sigmas: "0.55, 0.2, 0.0",
    imageStrength: 0.72,
    samplerName: LTX_SAMPLER_NAME,
  },
  balanced: DEFAULT_LTX_MOTION_PRESET,
  cinematic: {
    stage1Cfg: 4,
    stage2Cfg: 3.5,
    stage3Cfg: 3,
    stage1Sigmas: "1.0, 0.992, 0.984, 0.968, 0.94, 0.9, 0.85, 0.0",
    stage2Sigmas: "0.85, 0.78, 0.68, 0.55, 0.421, 0.0",
    stage3Sigmas: "0.421, 0.32, 0.24, 0.16, 0.0",
    imageStrength: 0.58,
    samplerName: LTX_SAMPLER_NAME,
  },
  "template-like": {
    stage1Cfg: 3.2,
    stage2Cfg: 3,
    stage3Cfg: 2.7,
    stage1Sigmas: "1.0, 0.98, 0.92, 0.85, 0.0",
    stage2Sigmas: "0.85, 0.7, 0.5, 0.0",
    stage3Sigmas: "0.5, 0.3, 0.0",
    imageStrength: 0.62,
    samplerName: "euler",
  },
};

export function normalizeLTXMotionProfile(value: unknown): MotionProfile {
  if (value === "fast" || value === "balanced" || value === "cinematic" || value === "template-like") {
    return value;
  }

  return DEFAULT_LTX_MOTION_PROFILE;
}

export function getLTXMotionProfilePreset(profile: MotionProfile): LTXMotionProfilePreset {
  return LTX_MOTION_PROFILE_PRESETS[profile];
}

export function buildLTXRunningHubNodeInfoList(
  payload: TimelinePayload,
  profile: MotionProfile,
  uploadedImageFileName: string,
  seed = LTX_DEFAULT_SEED,
): RunningHubNodeInfo[] {
  const preset = getLTXMotionProfilePreset(profile);
  const timelineJson = JSON.stringify(payload.timelineData);
  const segmentLengthsCsv = payload.timelineData.segments.map((segment) => segment.length).join(", ");
  const workflowFps = payload.summary.fps || LTX_WORKFLOW_FPS;
  const workflowFrameLength = payload.maxFrames + 1;

  return [
    { nodeId: "5", fieldName: "image", fieldValue: uploadedImageFileName.trim() },
    { nodeId: "11", fieldName: "value", fieldValue: workflowFps },
    { nodeId: "13", fieldName: "value", fieldValue: LTX_WORKFLOW_WIDTH },
    { nodeId: "15", fieldName: "value", fieldValue: LTX_WORKFLOW_HEIGHT },
    { nodeId: "17", fieldName: "value", fieldValue: workflowFrameLength },
    { nodeId: "19", fieldName: "value", fieldValue: seed },
    { nodeId: "26", fieldName: "img_compression", fieldValue: LTX_PREPROCESS_COMPRESSION },
    { nodeId: "28", fieldName: "strength", fieldValue: preset.imageStrength },
    { nodeId: "28", fieldName: "bypass", fieldValue: false },
    { nodeId: "39", fieldName: "global_prompt", fieldValue: payload.globalPrompt },
    { nodeId: "39", fieldName: "max_frames", fieldValue: workflowFrameLength },
    { nodeId: "39", fieldName: "timeline_data", fieldValue: timelineJson },
    { nodeId: "39", fieldName: "local_prompts", fieldValue: payload.localPrompts },
    { nodeId: "39", fieldName: "segment_lengths", fieldValue: segmentLengthsCsv },
    { nodeId: "39", fieldName: "epsilon", fieldValue: LTX_EPSILON },
    { nodeId: "39", fieldName: "fps", fieldValue: workflowFps },
    { nodeId: "39", fieldName: "time_units", fieldValue: LTX_TIME_UNITS },
    { nodeId: "49", fieldName: "global_prompt", fieldValue: payload.globalPrompt },
    { nodeId: "49", fieldName: "max_frames", fieldValue: workflowFrameLength },
    { nodeId: "49", fieldName: "timeline_data", fieldValue: timelineJson },
    { nodeId: "49", fieldName: "local_prompts", fieldValue: payload.localPrompts },
    { nodeId: "49", fieldName: "segment_lengths", fieldValue: segmentLengthsCsv },
    { nodeId: "49", fieldName: "epsilon", fieldValue: LTX_EPSILON },
    { nodeId: "49", fieldName: "fps", fieldValue: workflowFps },
    { nodeId: "49", fieldName: "time_units", fieldValue: LTX_TIME_UNITS },
    { nodeId: "58", fieldName: "global_prompt", fieldValue: payload.globalPrompt },
    { nodeId: "58", fieldName: "max_frames", fieldValue: workflowFrameLength },
    { nodeId: "58", fieldName: "timeline_data", fieldValue: timelineJson },
    { nodeId: "58", fieldName: "local_prompts", fieldValue: payload.localPrompts },
    { nodeId: "58", fieldName: "segment_lengths", fieldValue: segmentLengthsCsv },
    { nodeId: "58", fieldName: "epsilon", fieldValue: LTX_EPSILON },
    { nodeId: "58", fieldName: "fps", fieldValue: workflowFps },
    { nodeId: "58", fieldName: "time_units", fieldValue: LTX_TIME_UNITS },
    { nodeId: "40", fieldName: "frame_rate", fieldValue: workflowFps },
    { nodeId: "50", fieldName: "frame_rate", fieldValue: workflowFps },
    { nodeId: "59", fieldName: "frame_rate", fieldValue: workflowFps },
    { nodeId: "41", fieldName: "cfg", fieldValue: preset.stage1Cfg },
    { nodeId: "51", fieldName: "cfg", fieldValue: preset.stage2Cfg },
    { nodeId: "60", fieldName: "cfg", fieldValue: preset.stage3Cfg },
    { nodeId: "43", fieldName: "sigmas", fieldValue: preset.stage1Sigmas },
    { nodeId: "53", fieldName: "sigmas", fieldValue: preset.stage2Sigmas },
    { nodeId: "62", fieldName: "sigmas", fieldValue: preset.stage3Sigmas },
    { nodeId: "44", fieldName: "sampler_name", fieldValue: preset.samplerName },
    { nodeId: "70", fieldName: "frame_rate", fieldValue: workflowFps },
  ];
}