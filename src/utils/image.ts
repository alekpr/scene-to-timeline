import { stat } from "node:fs/promises";
import sharp from "sharp";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LONGEST_SIDE,
} from "../domain/constants.js";
import { AppError } from "../domain/types.js";

export async function loadImageAsBase64(imagePath: string): Promise<{
  base64: string;
  mediaType: "image/jpeg" | "image/png";
}> {
  let fileStat;
  try {
    fileStat = await stat(imagePath);
  } catch {
    throw new AppError(
      `Image file not found: ${imagePath}`,
      "IMAGE_NOT_FOUND",
      "Check the --image path and try again.",
    );
  }

  if (!fileStat.isFile()) {
    throw new AppError(
      `Image path is not a file: ${imagePath}`,
      "IMAGE_NOT_FILE",
      "Provide a valid jpg/png file path in --image.",
    );
  }

  if (fileStat.size > MAX_IMAGE_BYTES) {
    throw new AppError(
      "Image is larger than 5MB.",
      "IMAGE_TOO_LARGE",
      "Use a smaller image or compress it before running the command.",
    );
  }

  const image = sharp(imagePath, { failOn: "error" }).rotate();
  const metadata = await image.metadata();

  const inputFormat = metadata.format;
  if (inputFormat !== "jpeg" && inputFormat !== "jpg" && inputFormat !== "png") {
    throw new AppError(
      "Unsupported image format. Use JPG or PNG.",
      "IMAGE_UNSUPPORTED_FORMAT",
      "Convert your image to .jpg or .png then retry.",
    );
  }

  const processed = image.resize({
    width: MAX_IMAGE_LONGEST_SIDE,
    height: MAX_IMAGE_LONGEST_SIDE,
    fit: "inside",
    withoutEnlargement: true,
  });

  const outputBuffer =
    inputFormat === "png"
      ? await processed.png({ compressionLevel: 9 }).toBuffer()
      : await processed.jpeg({ quality: 88 }).toBuffer();

  const mediaType = inputFormat === "png" ? "image/png" : "image/jpeg";

  return {
    base64: outputBuffer.toString("base64"),
    mediaType,
  };
}
