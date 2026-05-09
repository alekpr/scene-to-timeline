import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeImageDataUriForTarget } from "../src/utils/image.js";

describe("image normalization", () => {
  it("normalizes uploaded data URI to exact workflow dimensions", async () => {
    const inputBuffer = await sharp({
      create: {
        width: 1280,
        height: 720,
        channels: 3,
        background: { r: 24, g: 48, b: 96 },
      },
    })
      .png()
      .toBuffer();
    const dataUri = `data:image/png;base64,${inputBuffer.toString("base64")}`;

    const normalized = await normalizeImageDataUriForTarget(dataUri, 720, 1280);
    const metadata = await sharp(normalized.buffer).metadata();

    expect(normalized.mediaType).toBe("image/jpeg");
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(720);
    expect(metadata.height).toBe(1280);
  });
});