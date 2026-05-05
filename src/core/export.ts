import { writeFile } from "node:fs/promises";
import { type TimelinePayload } from "../domain/types.js";
import { AppError } from "../domain/types.js";

export async function exportTimelineJSON(
  payload: TimelinePayload,
  filePath: string,
): Promise<void> {
  try {
    const json = JSON.stringify(payload, null, 2);
    await writeFile(filePath, json, "utf-8");
  } catch (error) {
    throw new AppError(
      `Failed to write output file: ${filePath}`,
      "FILE_WRITE_ERROR",
      "Check file path and permissions.",
    );
  }
}
