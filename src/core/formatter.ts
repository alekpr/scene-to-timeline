import { type TimelinePayload } from "../domain/types.js";

function section(title: string, field: string, body: string): string {
  return [
    `[${title}]`,
    `Use field: ${field}`,
    "----------------------------------------",
    body,
    "",
  ].join("\n");
}

export function formatTimelineOutput(payload: TimelinePayload): string {
  return [
    "========================================",
    " PROMPT RELAY ENCODE (TIMELINE) OUTPUT",
    "========================================",
    "",
    section("GLOBAL PROMPT", "global_prompt", payload.globalPrompt),
    section("LOCAL PROMPTS", "local_prompts", payload.localPrompts),
    section("SEGMENT LENGTHS", "segment_lengths", payload.segmentLengths),
    section("MAX FRAMES", "max_frames", String(payload.maxFrames)),
    section("TIMELINE DATA JSON", "timeline_data", JSON.stringify(payload.timelineData)),
    "========================================",
    "SUMMARY",
    "========================================",
    `Duration   : ${payload.summary.durationSeconds} seconds`,
    `Segments   : ${payload.summary.segmentCount}`,
    `FPS        : ${payload.summary.fps}`,
    `Max Frames : ${payload.maxFrames}`,
  ].join("\n");
}
