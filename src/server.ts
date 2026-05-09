import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { validateAndPrepareInput } from "./core/validator.js";
import { analyzeScene } from "./core/analyzer.js";
import { buildTimelinePayload } from "./core/builder.js";
import { formatTimelinePreview } from "./core/preview.js";
import {
  buildRunningHubNodeInfoList,
  normalizeMotionProfile,
  RUNNINGHUB_WORKFLOW_HEIGHT,
  RUNNINGHUB_WORKFLOW_WIDTH,
  type RunningHubNodeInfo,
} from "./core/runninghub.js";
import {
  LTX_WORKFLOW_HEIGHT,
  LTX_WORKFLOW_WIDTH,
} from "./core/ltxRunninghub.js";
import {
  buildRunningHubExecutionPlan,
  getRunningHubTargetDimensions,
  normalizeRunningHubWorkflowType,
  resolveRunningHubValidationInput,
  type RunningHubWorkflowType,
} from "./core/runninghubWorkflow.js";
import { AppError } from "./domain/types.js";
import { normalizeImageDataUriForTarget } from "./utils/image.js";

const app = express();
const PORT = process.env.PORT || 3000;
const RUNNINGHUB_BASE_URL = process.env.RUNNINGHUB_BASE_URL || "https://www.runninghub.ai";
const RUNNINGHUB_WORKFLOW_ID =
  process.env.RUNNINGHUB_WORKFLOW_ID || "2051573831675990018";
const RUNNINGHUB_LTX_WORKFLOW_ID = process.env.RUNNINGHUB_LTX_WORKFLOW_ID || "";

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

function normalizeRunningHubResult<T>(json: unknown): T {
  return json as T;
}

async function uploadImageToRunningHub(
  apiKey: string,
  imageDataUri: string,
  workflowType: RunningHubWorkflowType,
): Promise<string> {
  const { width: targetWidth, height: targetHeight } = getRunningHubTargetDimensions(workflowType);
  const { mediaType, buffer } = await normalizeImageDataUriForTarget(
    imageDataUri,
    targetWidth,
    targetHeight,
  );
  const extension = "jpg";
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
    data?: Record<string, unknown>;
  }>(await response.json());

  console.log("[uploadImageToRunningHub] raw response:", JSON.stringify(result));

  const data = result.data as Record<string, unknown> | undefined;
  const uploadedFileName = [
    data?.name,
    data?.path,
    data?.filePath,
    data?.file_path,
    data?.filename,
    data?.fileName,
    data?.file_name,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (!uploadedFileName) {
    throw new AppError(
      "RunningHub upload response missing filename.",
      "RUNNINGHUB_UPLOAD_INVALID_RESPONSE",
      `Upload response: ${JSON.stringify(result).slice(0, 500)}`,
    );
  }

  console.log("[uploadImageToRunningHub] uploadedFileName:", uploadedFileName);

  return uploadedFileName;
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
const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
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
      workflowType,
      preview = true,
    } = req.body;

    // Validate required fields
    if (!scene || !duration) {
      return res.status(400).json({
        error: "Missing required fields: scene, duration",
      });
    }

    // Prepare validated input
    const selectedWorkflowType = normalizeRunningHubWorkflowType(workflowType);
    const validated = await validateAndPrepareInput(
      resolveRunningHubValidationInput({
        scene,
        duration: String(duration),
        image: image || undefined,
        transcript: transcript || undefined,
        fps: fps ? String(fps) : undefined,
        segments: segments ? String(segments) : undefined,
        workflowType: selectedWorkflowType,
      }),
    );

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
      motionProfile,
      workflowType,
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

    const validated = await validateAndPrepareInput(
      resolveRunningHubValidationInput({
        scene,
        duration: String(duration),
        image: image || undefined,
        transcript: transcript || undefined,
        fps: fps ? String(fps) : undefined,
        segments: segments ? String(segments) : undefined,
        workflowType: normalizeRunningHubWorkflowType(workflowType),
      }),
    );

    const analysis = await analyzeScene(validated);
    const payload = buildTimelinePayload({
      analysis,
      durationSeconds: validated.durationSeconds,
      fps: validated.fps,
    });
    const selectedWorkflowType = normalizeRunningHubWorkflowType(workflowType);

    let uploadedImageFileName: string | undefined;
    console.log("[generate-and-run] image field type:", typeof image, "| value prefix:", typeof image === "string" ? image.slice(0, 30) : image);
    
    if (!image || (typeof image !== "string") || !image.startsWith("data:image/")) {
      throw new AppError(
        "Reference image is required for RunningHub workflow.",
        "IMAGE_REQUIRED",
        "Please select a reference image (JPG or PNG) to use as a starting point for video generation.",
      );
    }

    uploadedImageFileName = await uploadImageToRunningHub(
      runningHubApiKey,
      image,
      selectedWorkflowType,
    );

    const executionPlan = buildRunningHubExecutionPlan({
      payload,
      workflowType: selectedWorkflowType,
      motionProfile,
      uploadedImageFileName,
      workflowId,
      defaultWanWorkflowId: RUNNINGHUB_WORKFLOW_ID,
      defaultLtxWorkflowId: RUNNINGHUB_LTX_WORKFLOW_ID,
    });
    console.log(`[generate-and-run] workflow type: ${executionPlan.selectedWorkflowType}`);
    console.log("[generate-and-run] image node:", executionPlan.imageNodeValue ?? "<missing>");
    console.log("[generate-and-run] frame mapping:", JSON.stringify(executionPlan.frameNodes));

    let createdTaskId: string | number | undefined;
    let createResult: RunningHubCreateResponse | undefined;
    try {
      createResult = await startRunningHubTask({
        apiKey: runningHubApiKey,
        workflowId: executionPlan.selectedWorkflowId,
        nodeInfoList: executionPlan.nodeInfoList,
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

      createdTaskId = createResult.data?.taskId;
      if (createdTaskId === undefined || createdTaskId === null || String(createdTaskId).trim() === "") {
        throw new AppError(
          "RunningHub returned success but no taskId.",
          "RUNNINGHUB_TASKID_MISSING",
          createResult.data?.promptTips
            ? `promptTips: ${String(createResult.data.promptTips).slice(0, 400)}`
            : `Raw response: ${JSON.stringify(createResult).slice(0, 500)}`,
        );
      }
    } catch (error) {
      if (createdTaskId) {
        console.warn(
          "[generate-and-run] task creation/validation failed, attempting to cancel task",
          createdTaskId,
        );
        try {
          await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/cancel`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${runningHubApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              apiKey: runningHubApiKey,
              taskId: String(createdTaskId),
            }),
          });
          console.log("[generate-and-run] task cancelled successfully");
        } catch (cancelError) {
          console.error("[generate-and-run] failed to cancel task:", cancelError);
        }
      }
      throw error;
    }

    res.json({
      success: true,
      data: {
        workflowId: executionPlan.selectedWorkflowId,
        taskId: createdTaskId,
        taskStatus: createResult.data?.taskStatus,
        promptTips: createResult.data?.promptTips,
        uploadedImageFileName,
        workflowType: executionPlan.selectedWorkflowType,
        motionProfile: executionPlan.selectedMotionProfile,
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
if (isDirectExecution) {
  app.listen(PORT, () => {
    console.log(`\n🌐 Scene-to-Timeline Web UI running at http://localhost:${PORT}`);
    console.log(`📡 API endpoint: POST http://localhost:${PORT}/api/generate-timeline`);
    console.log(`🔧 Press Ctrl+C to stop\n`);
  });
}

export { app };
