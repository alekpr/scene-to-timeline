import { describe, expect, it } from "vitest";
import { buildTimelinePayload } from "../src/core/builder.js";
describe("timeline builder", () => {
    it("builds payload fields from analyzer output", () => {
        const payload = buildTimelinePayload({
            analysis: {
                global_prompt: "cinematic medium shot",
                segments: [
                    { prompt: "Subject stands still", weight: 1 },
                    { prompt: "Subject turns left", weight: 1 },
                ],
            },
            durationSeconds: 10,
            fps: 24,
        });
        expect(payload.maxFrames).toBe(240);
        expect(payload.summary.segmentCount).toBe(2);
        expect(payload.timelineData.segments).toHaveLength(2);
        expect(payload.segmentLengths).toContain("|");
        expect(payload.localPrompts).toContain("|");
    });
});
