import { type TimelinePayload } from "../domain/types.js";

export function formatTimelinePreview(payload: TimelinePayload): string {
  const segs = payload.timelineData.segments;
  const cellWidth = 40;
  const timeline: string[] = [];

  timeline.push("╔" + "═".repeat(cellWidth + 2) + "╗");
  timeline.push("║ " + "TIMELINE PREVIEW".padEnd(cellWidth) + " ║");
  timeline.push("╠" + "═".repeat(cellWidth + 2) + "╣");

  segs.forEach((seg, idx) => {
    const pct = ((seg.length / payload.maxFrames) * 100).toFixed(1);
    const barLen = Math.round((seg.length / payload.maxFrames) * 30);
    const bar = "█".repeat(barLen) + "░".repeat(30 - barLen);

    timeline.push(`║ Seg ${idx + 1}: ${pct.padStart(5)}% [${bar}] ║`);
    timeline.push(`║ ${seg.prompt.substring(0, cellWidth).padEnd(cellWidth)} ║`);
    timeline.push(`║ Frames: ${String(seg.length).padStart(3)} | Color: ${seg.color} ║`);
    if (idx < segs.length - 1) {
      timeline.push("╟" + "─".repeat(cellWidth + 2) + "╢");
    }
  });

  timeline.push("╚" + "═".repeat(cellWidth + 2) + "╝");

  return timeline.join("\n");
}
