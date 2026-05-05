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
