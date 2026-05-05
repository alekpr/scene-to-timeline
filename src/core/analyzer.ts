import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DEFAULT_ANTHROPIC_MODEL } from "../domain/constants.js";
import { AppError, type AnalyzerResult, type ValidatedInput } from "../domain/types.js";
import { calcSegmentCount, inferSegmentCountFromScene } from "../utils/frames.js";
import { SCENE_ANALYZER_SYSTEM_PROMPT } from "../prompts/systemPrompt.js";

const AnalyzerResultSchema = z.object({
  global_prompt: z.string().trim().min(1),
  segments: z
    .array(
      z.object({
        prompt: z.string().trim().min(1),
        weight: z.coerce.number().min(1).max(10),
      }),
    )
    .min(1),
});

function unwrapJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```") ) {
    return trimmed;
  }

  return trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function analyzeScene(input: ValidatedInput): Promise<AnalyzerResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "Missing ANTHROPIC_API_KEY.",
      "MISSING_API_KEY",
      "Create .env with ANTHROPIC_API_KEY=... then run again.",
    );
  }

  const segmentCount = input.requestedSegmentCount
    ? calcSegmentCount(input.durationSeconds, input.requestedSegmentCount)
    : inferSegmentCountFromScene(input.sceneOverview, input.durationSeconds);
  const secondsPerSegment = input.durationSeconds / segmentCount;

  const userText = [
    `Scene overview: ${input.sceneOverview}`,
    `Total duration: ${input.durationSeconds} seconds`,
    `Target segments: ${segmentCount} (approx. ${secondsPerSegment.toFixed(2)}s each)`,
    `Reference image: ${input.referenceImage ? "attached" : "none"}`,
    input.voiceoverTranscript ? `Voiceover transcript:\n${input.voiceoverTranscript}` : "No voiceover provided.",
    "Generate the timeline breakdown now.",
  ].join("\n");

  const client = new Anthropic({ apiKey });

  const content: Anthropic.Messages.MessageParam["content"] = [{
    type: "text",
    text: userText,
  }];

  if (input.referenceImage) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.referenceImage.mediaType,
        data: input.referenceImage.base64,
      },
    });
  }

  const message = await client.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 1200,
    system: SCENE_ANALYZER_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((item) => item.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AppError(
      "Analyzer returned no text response.",
      "ANALYZER_EMPTY_RESPONSE",
      "Try again with a more explicit scene description.",
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(unwrapJsonText(textBlock.text));
  } catch {
    throw new AppError(
      "Analyzer response is not valid JSON.",
      "ANALYZER_INVALID_JSON",
      "Simplify scene text or rerun. The model must return strict JSON only.",
    );
  }

  const parsed = AnalyzerResultSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new AppError(
      "Analyzer JSON does not match required schema.",
      "ANALYZER_SCHEMA_ERROR",
      "Ensure global_prompt exists and segments[] include prompt + weight (1-10).",
    );
  }

  return parsed.data;
}
