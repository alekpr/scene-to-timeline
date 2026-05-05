import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { validateAndPrepareInput } from "./core/validator.js";
import { analyzeScene } from "./core/analyzer.js";
import { buildTimelinePayload } from "./core/builder.js";
import { formatTimelineOutput } from "./core/formatter.js";
import { formatTimelinePreview } from "./core/preview.js";
import { AppError } from "./domain/types.js";

const app = express();
const PORT = process.env.PORT || 3000;
const RUNNINGHUB_BASE_URL = process.env.RUNNINGHUB_BASE_URL || "https://www.runninghub.ai";
const RUNNINGHUB_WORKFLOW_ID =
  process.env.RUNNINGHUB_WORKFLOW_ID || "2051573831675990018";

interface RunningHubNodeInfo {
  nodeId: string;
  fieldName: string;
  fieldValue: string | number | boolean;
}

interface RunningHubCreateResponse {
  code: number;
  msg?: string;
  message?: string;
  data?: {
    taskId?: string | number;
    taskStatus?: string;
    promptTips?: string;
    [key: string]: unknown;
  };
}

interface RunningHubOutputItem {
  fileUrl?: string;
  fileType?: string;
  taskCostTime?: string;
  nodeId?: string;
  [key: string]: unknown;
}

function parseImageDataUri(dataUri: string): { mediaType: string; buffer: Buffer } {
  const match = dataUri.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (!match) {
    throw new AppError(
      "Invalid image data URI format.",
      "INVALID_IMAGE_DATA_URI",
      "Expected format: data:image/jpeg;base64,... or data:image/png;base64,...",
    );
  }

  const [, mediaType, base64] = match;
  return {
    mediaType,
    buffer: Buffer.from(base64, "base64"),
  };
}

function normalizeRunningHubResult<T>(json: unknown): T {
  return json as T;
}

async function uploadImageToRunningHub(apiKey: string, imageDataUri: string): Promise<string> {
  const { mediaType, buffer } = parseImageDataUri(imageDataUri);
  const extension = mediaType === "image/png" ? "png" : "jpg";
  const fileBytes = new Uint8Array(buffer);
  const file = new File([fileBytes], `scene-input.${extension}`, { type: mediaType });

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${RUNNINGHUB_BASE_URL}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(
      `RunningHub upload failed with HTTP ${response.status}.`,
      "RUNNINGHUB_UPLOAD_HTTP_ERROR",
      text.slice(0, 300),
    );
  }

  const result = normalizeRunningHubResult<{
    code?: number;
    message?: string;
    msg?: string;
    data?: { filename?: string; fileName?: string };
  }>(await response.json());

  const uploadedFileName = result.data?.filename || result.data?.fileName;
  if (!uploadedFileName) {
    throw new AppError(
      "RunningHub upload response missing filename.",
      "RUNNINGHUB_UPLOAD_INVALID_RESPONSE",
      `Upload response: ${JSON.stringify(result).slice(0, 500)}`,
    );
  }

  return uploadedFileName;
}

function buildRunningHubNodeInfoList(
  payload: {
    globalPrompt: string;
    maxFrames: number;
    timelineData: { segments: Array<{ prompt: string; length: number; color: string }> };
    localPrompts: string;
    summary: { fps: number };
  },
  uploadedImageFileName?: string,
): RunningHubNodeInfo[] {
  const segmentLengthsCsv = payload.timelineData.segments.map((segment) => segment.length).join(", ");
  const timelineJson = JSON.stringify(payload.timelineData);

  const nodeInfoList: RunningHubNodeInfo[] = [
    { nodeId: "117", fieldName: "global_prompt", fieldValue: payload.globalPrompt },
    { nodeId: "117", fieldName: "max_frames", fieldValue: payload.maxFrames + 1 },
    { nodeId: "117", fieldName: "timeline_data", fieldValue: timelineJson },
    { nodeId: "117", fieldName: "local_prompts", fieldValue: payload.localPrompts },
    { nodeId: "117", fieldName: "segment_lengths", fieldValue: segmentLengthsCsv },
    { nodeId: "117", fieldName: "fps", fieldValue: payload.summary.fps },
    { nodeId: "129", fieldName: "global_prompt", fieldValue: payload.globalPrompt },
    { nodeId: "129", fieldName: "max_frames", fieldValue: payload.maxFrames + 1 },
    { nodeId: "129", fieldName: "timeline_data", fieldValue: timelineJson },
    { nodeId: "129", fieldName: "local_prompts", fieldValue: payload.localPrompts },
    { nodeId: "129", fieldName: "segment_lengths", fieldValue: segmentLengthsCsv },
    { nodeId: "129", fieldName: "fps", fieldValue: payload.summary.fps },
    { nodeId: "79", fieldName: "length", fieldValue: payload.maxFrames + 1 },
    { nodeId: "121", fieldName: "length", fieldValue: payload.maxFrames + 1 },
    { nodeId: "108", fieldName: "frame_rate", fieldValue: payload.summary.fps },
  ];

  if (uploadedImageFileName) {
    nodeInfoList.push({
      nodeId: "85",
      fieldName: "image",
      fieldValue: uploadedImageFileName,
    });
  }

  return nodeInfoList;
}

async function startRunningHubTask(params: {
  apiKey: string;
  workflowId: string;
  nodeInfoList: RunningHubNodeInfo[];
}): Promise<RunningHubCreateResponse> {
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/create`, {
    method: "POST",
    headers: {
      Host: "www.runninghub.ai",
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: params.apiKey,
      workflowId: params.workflowId,
      nodeInfoList: params.nodeInfoList,
      addMetadata: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(
      `RunningHub create task failed with HTTP ${response.status}.`,
      "RUNNINGHUB_CREATE_HTTP_ERROR",
      text.slice(0, 300),
    );
  }

  return normalizeRunningHubResult<RunningHubCreateResponse>(await response.json());
}

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

// Serve static files (frontend)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../public")));

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Main timeline generation endpoint
app.post("/api/generate-timeline", async (req: Request, res: Response) => {
  try {
    const {
      scene,
      duration,
      image,
      transcript,
      fps,
      segments,
      preview = true,
    } = req.body;

    // Validate required fields
    if (!scene || !duration) {
      return res.status(400).json({
        error: "Missing required fields: scene, duration",
      });
    }

    // Prepare validated input
    const validated = await validateAndPrepareInput({
      scene,
      duration: String(duration),
      image: image || undefined,
      transcript: transcript || undefined,
      fps: fps ? String(fps) : undefined,
      segments: segments ? String(segments) : undefined,
      output: undefined,
      preview: false,
      copy: false,
    });

    // Analyze scene with AI
    const analysis = await analyzeScene(validated);

    // Build timeline payload
    const payload = buildTimelinePayload({
      analysis,
      durationSeconds: validated.durationSeconds,
      fps: validated.fps,
    });

    // Format output
    const previewOutput = formatTimelinePreview(payload);

    // Return structured response
    res.json({
      success: true,
      data: {
        payload,
        previewOutput: preview ? previewOutput : undefined,
        summary: {
          duration: validated.durationSeconds,
          segmentCount: payload.summary.segmentCount,
          fps: validated.fps,
          maxFrames: payload.maxFrames,
        },
      },
    });
  } catch (error) {
    console.error("Error generating timeline:", error);

    if (error instanceof AppError) {
      return res.status(400).json({
        error: error.message,
        hint: error.hint,
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "Failed to generate timeline",
      details: message,
    });
  }
});

// Generate timeline, map fields to RunningHub workflow, and start task on cloud.
app.post("/api/generate-and-run-runninghub", async (req: Request, res: Response) => {
  try {
    const {
      scene,
      duration,
      image,
      transcript,
      fps,
      segments,
      workflowId,
    } = req.body;

    if (!scene || !duration) {
      return res.status(400).json({
        error: "Missing required fields: scene, duration",
      });
    }

    const runningHubApiKey = process.env.RUNNINGHUB_API_KEY;
    if (!runningHubApiKey) {
      throw new AppError(
        "Missing RUNNINGHUB_API_KEY.",
        "MISSING_RUNNINGHUB_API_KEY",
        "Set RUNNINGHUB_API_KEY in .env before using cloud workflow integration.",
      );
    }

    const validated = await validateAndPrepareInput({
      scene,
      duration: String(duration),
      image: image || undefined,
      transcript: transcript || undefined,
      fps: fps ? String(fps) : undefined,
      segments: segments ? String(segments) : undefined,
      output: undefined,
      preview: false,
      copy: false,
    });

    const analysis = await analyzeScene(validated);
    const payload = buildTimelinePayload({
      analysis,
      durationSeconds: validated.durationSeconds,
      fps: validated.fps,
    });

    let uploadedImageFileName: string | undefined;
    if (typeof image === "string" && image.startsWith("data:image/")) {
      uploadedImageFileName = await uploadImageToRunningHub(runningHubApiKey, image);
    }

    const nodeInfoList = buildRunningHubNodeInfoList(payload, uploadedImageFileName);
    const selectedWorkflowId = typeof workflowId === "string" && workflowId.trim()
      ? workflowId.trim()
      : RUNNINGHUB_WORKFLOW_ID;

    const createResult = await startRunningHubTask({
      apiKey: runningHubApiKey,
      workflowId: selectedWorkflowId,
      nodeInfoList,
    });

    if (createResult.code !== 0) {
      throw new AppError(
        `RunningHub rejected task: ${createResult.msg || createResult.message || "Unknown error"}`,
        "RUNNINGHUB_CREATE_REJECTED",
        createResult.data?.promptTips
          ? `promptTips: ${String(createResult.data.promptTips).slice(0, 400)}`
          : "Check workflowId, nodeInfoList mapping, and API key/account balance.",
      );
    }

    const createdTaskId = createResult.data?.taskId;
    if (createdTaskId === undefined || createdTaskId === null || String(createdTaskId).trim() === "") {
      throw new AppError(
        "RunningHub returned success but no taskId.",
        "RUNNINGHUB_TASKID_MISSING",
        createResult.data?.promptTips
          ? `promptTips: ${String(createResult.data.promptTips).slice(0, 400)}`
          : `Raw response: ${JSON.stringify(createResult).slice(0, 500)}`,
      );
    }

    res.json({
      success: true,
      data: {
        workflowId: selectedWorkflowId,
        taskId: createdTaskId,
        taskStatus: createResult.data?.taskStatus,
        promptTips: createResult.data?.promptTips,
        uploadedImageFileName,
        timeline: payload,
      },
    });
  } catch (error) {
    console.error("Error generate-and-run-runninghub:", error);

    if (error instanceof AppError) {
      return res.status(400).json({
        error: error.message,
        code: error.code,
        hint: error.hint,
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "Failed to generate and run workflow on RunningHub",
      details: message,
    });
  }
});

app.post("/api/runninghub/task-status", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "Missing required field: taskId" });
    }

    const runningHubApiKey = process.env.RUNNINGHUB_API_KEY;
    if (!runningHubApiKey) {
      throw new AppError(
        "Missing RUNNINGHUB_API_KEY.",
        "MISSING_RUNNINGHUB_API_KEY",
        "Set RUNNINGHUB_API_KEY in .env before querying cloud task status.",
      );
    }

    const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/status`, {
      method: "POST",
      headers: {
        Host: "www.runninghub.ai",
        Authorization: `Bearer ${runningHubApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: runningHubApiKey,
        taskId: String(taskId),
      }),
    });

    const result = await response.json();
    res.status(response.ok ? 200 : 500).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to query RunningHub task status", details: message });
  }
});

app.post("/api/runninghub/task-output", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "Missing required field: taskId" });
    }

    const runningHubApiKey = process.env.RUNNINGHUB_API_KEY;
    if (!runningHubApiKey) {
      throw new AppError(
        "Missing RUNNINGHUB_API_KEY.",
        "MISSING_RUNNINGHUB_API_KEY",
        "Set RUNNINGHUB_API_KEY in .env before querying cloud task output.",
      );
    }

    const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
      method: "POST",
      headers: {
        Host: "www.runninghub.ai",
        Authorization: `Bearer ${runningHubApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: runningHubApiKey,
        taskId: String(taskId),
      }),
    });

    const result = normalizeRunningHubResult<{ code?: number; msg?: string; data?: RunningHubOutputItem[] }>(await response.json());
    res.status(response.ok ? 200 : 500).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to query RunningHub task output", details: message });
  }
});

app.post("/api/runninghub/task-cancel", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "Missing required field: taskId" });
    }

    const runningHubApiKey = process.env.RUNNINGHUB_API_KEY;
    if (!runningHubApiKey) {
      throw new AppError(
        "Missing RUNNINGHUB_API_KEY.",
        "MISSING_RUNNINGHUB_API_KEY",
        "Set RUNNINGHUB_API_KEY in .env before canceling cloud tasks.",
      );
    }

    const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/cancel`, {
      method: "POST",
      headers: {
        Host: "www.runninghub.ai",
        Authorization: `Bearer ${runningHubApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: runningHubApiKey,
        taskId: String(taskId),
      }),
    });

    const result = await response.json();
    res.status(response.ok ? 200 : 500).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to cancel RunningHub task", details: message });
  }
});

// Serve index.html for all unmatched routes (SPA fallback)
app.get(/.*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Error handling middleware
app.use(
  (
    err: any,
    _req: Request,
    res: Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      details: process.env.DEBUG ? err.message : undefined,
    });
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`\n🌐 Scene-to-Timeline Web UI running at http://localhost:${PORT}`);
  console.log(`📡 API endpoint: POST http://localhost:${PORT}/api/generate-timeline`);
  console.log(`🔧 Press Ctrl+C to stop\n`);
});
