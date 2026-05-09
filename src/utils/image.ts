import { stat } from "node:fs/promises";
import sharp from "sharp";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LONGEST_SIDE,
} from "../domain/constants.js";
import { AppError } from "../domain/types.js";

/**
 * Parse image input: either a file path or a data URI
 * Handles both CLI (file paths) and Web UI (data URIs)
 */
export async function loadImageAsBase64(imageInput: string): Promise<{
  base64: string;
  mediaType: "image/jpeg" | "image/png";
}> {
  // Check if input is a data URI (from web UI)
  if (imageInput.startsWith("data:image/")) {
    return parseDataUri(imageInput);
  }

  // Otherwise, treat as file path (from CLI)
  return loadImageFromFile(imageInput);
}

export async function normalizeImageDataUriForTarget(
  dataUri: string,
  targetWidth: number,
  targetHeight: number,
): Promise<{
  buffer: Buffer;
  mediaType: "image/jpeg";
}> {
  const parsed = parseDataUri(dataUri);
  const inputBuffer = Buffer.from(parsed.base64, "base64");
  const outputBuffer = await sharp(inputBuffer, { failOn: "error" })
    .rotate()
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  return {
    buffer: outputBuffer,
    mediaType: "image/jpeg",
  };
}

/**
 * Parse a data URI and extract base64 + media type
 */
function parseDataUri(dataUri: string): {
  base64: string;
  mediaType: "image/jpeg" | "image/png";
} {
  // Format: data:image/jpeg;base64,/9j/4AAQSkZ... or data:image/png;base64,...
  const match = dataUri.match(/^data:image\/(jpeg|png);base64,(.+)$/);

  if (!match) {
    throw new AppError(
      "Invalid data URI format for image",
      "IMAGE_INVALID_URI",
      "Image data URI must be in format: data:image/jpeg;base64,... or data:image/png;base64,...",
    );
  }

  const [, format, base64String] = match;
  const mediaType = format === "jpeg" ? "image/jpeg" : "image/png";

  // Validate size by checking base64 length
  // Base64 encoded size = (decoded size / 3) * 4
  // So decoded size ≈ (base64 length / 4) * 3
  const estimatedBytes = Math.ceil((base64String.length / 4) * 3);

  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new AppError(
      "Image is larger than 5MB.",
      "IMAGE_TOO_LARGE",
      "Use a smaller image or compress it before uploading.",
    );
  }

  return {
    base64: base64String,
    mediaType,
  };
}

/**
 * Load image from file path and convert to base64
 */
async function loadImageFromFile(imagePath: string): Promise<{
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
