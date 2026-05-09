import { AppError, type AnalyzerResult, type TimelinePayload } from "../domain/types.js";
import { buildSegmentColors } from "../utils/colors.js";
import { calcMaxFrames, distributeFramesByWeights } from "../utils/frames.js";

const MOTION_VERB_PATTERN =
  /\b(moves?|walks?|runs?|jumps?|falls?|rises?|opens?|closes?|reaches?|swings?|accelerates?|push(?:es)?|pull(?:s)?|flows?|sweeps?|lifts?|turns?|leans?|speaks?|glitches?|zooms?|pans?|tracks?|spins?|lunges?|crashes?|drifts?|orbits?|whip(?:s)?|doll(?:y|ies)|rush(?:es)?)\b/gi;

interface BuildTimelineInput {
  analysis: AnalyzerResult;
  durationSeconds: number;
  fps: number;
}

function rebalanceSegmentWeights(segments: AnalyzerResult["segments"]): number[] {
  const weights = segments.map((segment) => segment.weight);

  if (segments.length < 2) {
    return weights;
  }

  const motionScores = segments.map((segment) => {
    const matches = segment.prompt.match(MOTION_VERB_PATTERN);
    return matches ? matches.length : 0;
  });

  const openerHasMotion = motionScores[0] > 0;

  if (!openerHasMotion && weights[0] > 1) {
    weights[0] -= 1;
  }

  if (segments.length >= 3) {
    let targetIndex = 0;
    for (let i = 1; i < motionScores.length; i += 1) {
      if (motionScores[i] > motionScores[targetIndex]) {
        targetIndex = i;
      }
    }

    if (targetIndex > 0 && motionScores[targetIndex] >= 2 && weights[targetIndex] < 10) {
      const donorIndex = weights.findIndex((weight, index) => index !== targetIndex && motionScores[index] === 0 && weight > 1);
      if (donorIndex >= 0) {
        weights[donorIndex] -= 1;
        weights[targetIndex] += 1;
      }
    }
  }

  return weights;
}

export function buildTimelinePayload(input: BuildTimelineInput): TimelinePayload {
  const maxFrames = calcMaxFrames(input.durationSeconds, input.fps);
  const weights = rebalanceSegmentWeights(input.analysis.segments);
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
