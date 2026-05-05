import { AppError, type AnalyzerResult, type TimelinePayload } from "../domain/types.js";
import { buildSegmentColors } from "../utils/colors.js";
import { calcMaxFrames, distributeFramesByWeights } from "../utils/frames.js";

interface BuildTimelineInput {
  analysis: AnalyzerResult;
  durationSeconds: number;
  fps: number;
}

export function buildTimelinePayload(input: BuildTimelineInput): TimelinePayload {
  const maxFrames = calcMaxFrames(input.durationSeconds, input.fps);
  const weights = input.analysis.segments.map((segment) => segment.weight);
  const lengths = distributeFramesByWeights(weights, maxFrames);

  const sum = lengths.reduce((acc, value) => acc + value, 0);
  if (sum !== maxFrames) {
    throw new AppError(
      "Internal frame allocation mismatch.",
      "FRAME_ALLOCATION_MISMATCH",
      "Report this issue with your input values.",
    );
  }

  const colors = buildSegmentColors(input.analysis.segments.length);
  const timelineSegments = input.analysis.segments.map((segment, index) => ({
    prompt: segment.prompt,
    length: lengths[index],
    color: colors[index],
  }));

  const localPrompts = input.analysis.segments.map((segment) => segment.prompt).join(" | ");
  const segmentLengths = lengths.join(" | ");

  return {
    globalPrompt: input.analysis.global_prompt,
    localPrompts,
    segmentLengths,
    maxFrames,
    timelineData: {
      segments: timelineSegments,
    },
    summary: {
      durationSeconds: input.durationSeconds,
      fps: input.fps,
      segmentCount: input.analysis.segments.length,
    },
  };
}
