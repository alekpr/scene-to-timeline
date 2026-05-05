#!/usr/bin/env node
import "dotenv/config";
import chalk from "chalk";
import clipboard from "clipboardy";
import { Command } from "commander";
import { analyzeScene } from "../core/analyzer.js";
import { buildTimelinePayload } from "../core/builder.js";
import { exportTimelineJSON } from "../core/export.js";
import { formatTimelineOutput } from "../core/formatter.js";
import { formatTimelinePreview } from "../core/preview.js";
import { validateAndPrepareInput } from "../core/validator.js";
import { AppError, type CliOptions } from "../domain/types.js";

const program = new Command();

program
  .name("scene-to-timeline")
  .description("Generate Prompt Relay Timeline fields from scene descriptions")
  .requiredOption("--scene <text>", "Scene overview text (Thai/English)")
  .requiredOption("--duration <seconds>", "Target video duration in seconds")
  .option("--image <path>", "Optional reference image (.jpg/.png)")
  .option("--transcript <text>", "Optional voiceover transcript (Thai/English)")
  .option("--fps <number>", "Frame rate (default: 24)")
  .option("--segments <number>", "Override segment count (default: duration/3)")
  .option("--output <path>", "Save timeline JSON to file")
  .option("--preview", "Show timeline preview in terminal")
  .option("--no-copy", "Disable auto-copy output to clipboard");

async function run(): Promise<void> {
  const raw = program.parse().opts<CliOptions>();

  const validated = await validateAndPrepareInput(raw);
  const analysis = await analyzeScene(validated);

  const payload = buildTimelinePayload({
    analysis,
    durationSeconds: validated.durationSeconds,
    fps: validated.fps,
  });

  const output = formatTimelineOutput(payload);
  console.log(output);

  if (validated.previewMode) {
    console.log("\n");
    console.log(formatTimelinePreview(payload));
  }

  if (validated.outputPath) {
    await exportTimelineJSON(payload, validated.outputPath);
    console.log(chalk.green(`\n✓ Saved JSON to: ${validated.outputPath}`));
  }

  if (raw.copy !== false) {
    try {
      await clipboard.write(output);
      console.log(chalk.green("\nCopied output to clipboard."));
    } catch {
      console.log(chalk.yellow("\nClipboard not available. Output printed above."));
    }
  }
}

run().catch((error: unknown) => {
  if (error instanceof AppError) {
    console.error(chalk.red(`Error [${error.code}]: ${error.message}`));
    if (error.hint) {
      console.error(chalk.yellow(`Hint: ${error.hint}`));
    }
    process.exit(1);
  }

  console.error(chalk.red("Unexpected error."));
  console.error(error);
  process.exit(1);
});
