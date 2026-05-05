import { describe, expect, it } from "vitest";
import { validateAndPrepareInput } from "../src/core/validator.js";
describe("validator", () => {
    it("accepts Thai and English scene text", async () => {
        const result = await validateAndPrepareInput({
            scene: "ผู้หญิงเดินในตรอกนีออน at night",
            duration: "10",
        });
        expect(result.sceneOverview).toContain("ผู้หญิง");
        expect(result.durationSeconds).toBe(10);
        expect(result.fps).toBe(24);
    });
    it("throws for invalid duration", async () => {
        await expect(validateAndPrepareInput({
            scene: "A valid scene",
            duration: "0",
        })).rejects.toThrow("Invalid input");
    });
});
