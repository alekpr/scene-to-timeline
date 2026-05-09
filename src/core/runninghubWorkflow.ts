import { AppError, type TimelinePayload } from "../domain/types.js";
import {
  buildLTXRunningHubNodeInfoList,
  LTX_WORKFLOW_FPS,
  LTX_WORKFLOW_HEIGHT,
  LTX_WORKFLOW_WIDTH,
  normalizeLTXMotionProfile,
} from "./ltxRunninghub.js";
import {
  buildRunningHubNodeInfoList,
  normalizeMotionProfile,
  RUNNINGHUB_WORKFLOW_HEIGHT,
  RUNNINGHUB_WORKFLOW_WIDTH,
  type MotionProfile,
  type RunningHubNodeInfo,
} from "./runninghub.js";

export type RunningHubWorkflowType = "wan" | "ltx";

export interface RunningHubValidationInput {
  scene: string;
  duration: string;
  image?: string;
  transcript?: string;
  fps?: string;
  segments?: string;
  output?: string;
  preview?: boolean;
  copy?: boolean;
}

export interface RunningHubExecutionPlan {
  selectedWorkflowType: RunningHubWorkflowType;
  selectedMotionProfile: MotionProfile;
  selectedWorkflowId: string;
  nodeInfoList: RunningHubNodeInfo[];
  imageNodeValue?: string | number | boolean;
  frameNodes: RunningHubNodeInfo[];
}

export function normalizeRunningHubWorkflowType(value: unknown): RunningHubWorkflowType {
  return value === "wan" ? "wan" : "ltx";
}

export function getRunningHubTargetDimensions(workflowType: RunningHubWorkflowType): {
  width: number;
  height: number;
} {
  return workflowType === "ltx"
    ? { width: LTX_WORKFLOW_WIDTH, height: LTX_WORKFLOW_HEIGHT }
    : { width: RUNNINGHUB_WORKFLOW_WIDTH, height: RUNNINGHUB_WORKFLOW_HEIGHT };
}

export function resolveRunningHubValidationInput(input: {
  scene: string;
  duration: string;
  image?: string;
  transcript?: string;
  fps?: string;
  segments?: string;
  workflowType: RunningHubWorkflowType;
}): RunningHubValidationInput {
  return {
    scene: input.scene,
    duration: input.duration,
    image: input.image,
    transcript: input.transcript,
    fps: input.fps ?? (input.workflowType === "ltx" ? String(LTX_WORKFLOW_FPS) : undefined),
    segments: input.segments,
    output: undefined,
    preview: false,
    copy: false,
  };
}

export function buildRunningHubExecutionPlan(input: {
  payload: TimelinePayload;
  workflowType: RunningHubWorkflowType;
  motionProfile: unknown;
  uploadedImageFileName: string;
  workflowId?: string;
  defaultWanWorkflowId: string;
  defaultLtxWorkflowId: string;
}): RunningHubExecutionPlan {
  const selectedWorkflowType = normalizeRunningHubWorkflowType(input.workflowType);
  const selectedMotionProfile = selectedWorkflowType === "ltx"
    ? normalizeLTXMotionProfile(input.motionProfile)
    : normalizeMotionProfile(input.motionProfile);
  const nodeInfoList = selectedWorkflowType === "ltx"
    ? buildLTXRunningHubNodeInfoList(input.payload, selectedMotionProfile, input.uploadedImageFileName)
    : buildRunningHubNodeInfoList(input.payload, selectedMotionProfile, input.uploadedImageFileName);
  const selectedWorkflowId = typeof input.workflowId === "string" && input.workflowId.trim()
    ? input.workflowId.trim()
    : selectedWorkflowType === "ltx"
      ? input.defaultLtxWorkflowId
      : input.defaultWanWorkflowId;

  if (!selectedWorkflowId) {
    throw new AppError(
      "Missing workflow id for selected RunningHub workflow.",
      "MISSING_RUNNINGHUB_WORKFLOW_ID",
      selectedWorkflowType === "ltx"
        ? "Set RUNNINGHUB_LTX_WORKFLOW_ID in .env before using the LTX workflow."
        : "Set RUNNINGHUB_WORKFLOW_ID in .env before using the Wan workflow.",
    );
  }

  return {
    selectedWorkflowType,
    selectedMotionProfile,
    selectedWorkflowId,
    nodeInfoList,
    imageNodeValue: nodeInfoList.find((item) => item.fieldName === "image")?.fieldValue,
    frameNodes: selectedWorkflowType === "ltx"
      ? nodeInfoList.filter(
          (item) =>
            (item.nodeId === "17" && item.fieldName === "value") ||
            ((item.nodeId === "39" || item.nodeId === "49" || item.nodeId === "58") &&
              item.fieldName === "max_frames") ||
            (item.nodeId === "70" && item.fieldName === "frame_rate"),
        )
      : nodeInfoList.filter(
          (item) =>
            (item.nodeId === "117" && item.fieldName === "max_frames") ||
            (item.nodeId === "129" && item.fieldName === "max_frames") ||
            (item.nodeId === "79" && item.fieldName === "length") ||
            (item.nodeId === "121" && item.fieldName === "length"),
        ),
  };
}