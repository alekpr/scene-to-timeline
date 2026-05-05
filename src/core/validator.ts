import { z } from "zod";
import { DEFAULT_FPS } from "../domain/constants.js";
import { AppError, type CliOptions, type ValidatedInput } from "../domain/types.js";
import { loadImageAsBase64 } from "../utils/image.js";

const CliSchema = z.object({
  scene: z.string().trim().min(1),
  duration: z.coerce.number().positive(),
  image: z.string().trim().min(1).optional(),
  transcript: z.string().trim().min(1).optional(),
});

export async function validateAndPrepareInput(options: CliOptions): Promise<ValidatedInput> {
  const result = CliSchema.safeParse(options);

  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError(
      `Invalid input: ${first?.message ?? "Unknown validation error."}`,
      "INVALID_INPUT",
      "Required: --scene <text> and --duration <positive number>",
    );
  }

  const parsed = result.data;
  let referenceImage: ValidatedInput["referenceImage"];

  if (parsed.image) {
    const image = await loadImageAsBase64(parsed.image);
    referenceImage = {
      base64: image.base64,
      mediaType: image.mediaType,
      originalPath: parsed.image,
    };
  }

  return {
    sceneOverview: parsed.scene,
    durationSeconds: parsed.duration,
    fps: DEFAULT_FPS,
    referenceImage,
    voiceoverTranscript: parsed.transcript,
  };
}
