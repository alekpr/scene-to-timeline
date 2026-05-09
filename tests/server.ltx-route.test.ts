import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { type AnalyzerResult, type TimelinePayload, type ValidatedInput } from "../src/domain/types.js";

const validateAndPrepareInputMock = vi.fn<
  (options: Record<string, unknown>) => Promise<ValidatedInput>
>();
const analyzeSceneMock = vi.fn<() => Promise<AnalyzerResult>>();
const buildTimelinePayloadMock = vi.fn<() => TimelinePayload>();

vi.mock("../src/core/validator.js", () => ({
  validateAndPrepareInput: validateAndPrepareInputMock,
}));

vi.mock("../src/core/analyzer.js", () => ({
  analyzeScene: analyzeSceneMock,
}));

vi.mock("../src/core/builder.js", () => ({
  buildTimelinePayload: buildTimelinePayloadMock,
}));

describe("server route: ltx runninghub", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.RUNNINGHUB_API_KEY;
  const originalWanId = process.env.RUNNINGHUB_WORKFLOW_ID;
  const originalLtxId = process.env.RUNNINGHUB_LTX_WORKFLOW_ID;
  let server: Server | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.RUNNINGHUB_API_KEY = "test-api-key";
    process.env.RUNNINGHUB_WORKFLOW_ID = "wan-workflow-id";
    process.env.RUNNINGHUB_LTX_WORKFLOW_ID = "ltx-workflow-id";

    validateAndPrepareInputMock.mockImplementation(async (options) => ({
      sceneOverview: String(options.scene),
      durationSeconds: Number(options.duration),
      fps: Number(options.fps),
      requestedSegmentCount: options.segments ? Number(options.segments) : undefined,
      referenceImage: undefined,
      voiceoverTranscript: options.transcript ? String(options.transcript) : undefined,
      outputPath: undefined,
      previewMode: false,
    }));

    analyzeSceneMock.mockResolvedValue({
      global_prompt: "ltx hacker room",
      segments: [
        { prompt: "segment a", weight: 4 },
        { prompt: "segment b", weight: 6 },
      ],
    });

    buildTimelinePayloadMock.mockReturnValue({
      globalPrompt: "ltx hacker room",
      localPrompts: "segment a | segment b",
      segmentLengths: "96, 97",
      maxFrames: 193,
      timelineData: {
        segments: [
          { prompt: "segment a", length: 96, color: "#111111" },
          { prompt: "segment b", length: 97, color: "#222222" },
        ],
      },
      summary: {
        durationSeconds: 8,
        fps: 24,
        segmentCount: 2,
      },
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      server = undefined;
    }

    global.fetch = originalFetch;
    process.env.RUNNINGHUB_API_KEY = originalApiKey;
    process.env.RUNNINGHUB_WORKFLOW_ID = originalWanId;
    process.env.RUNNINGHUB_LTX_WORKFLOW_ID = originalLtxId;
  });

  it("uses LTX defaults and node plan when workflowType is ltx", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/openapi/v2/media/upload/binary")) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: { fileName: "openapi/frame.jpeg" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/task/openapi/create")) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: { taskId: "task-123", taskStatus: "QUEUED" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });
    global.fetch = fetchMock;

    const { app } = await import("../src/server.js");
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server?.listen(0, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve test server address");
    }

    const imageBuffer = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 24, g: 48, b: 96 },
      },
    })
      .png()
      .toBuffer();
    const imageDataUri = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/generate-and-run-runninghub`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene: "test scene",
        duration: 8,
        workflowType: "ltx",
        motionProfile: "balanced",
        image: imageDataUri,
      }),
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(validateAndPrepareInputMock).toHaveBeenCalledTimes(1);
    expect(validateAndPrepareInputMock.mock.calls[0]?.[0]).toMatchObject({
      fps: "24",
      duration: "8",
      scene: "test scene",
    });

    const createCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/task/openapi/create"));
    expect(createCall).toBeDefined();

    const createBody = JSON.parse(String(createCall?.[1]?.body ?? "{}"));
    const byKey = new Map(
      createBody.nodeInfoList.map((item: { nodeId: string; fieldName: string; fieldValue: string | number | boolean }) => [
        `${item.nodeId}:${item.fieldName}`,
        item.fieldValue,
      ]),
    );

    expect(createBody.workflowId).toBe("ltx-workflow-id");
    expect(byKey.get("5:image")).toBe("openapi/frame.jpeg");
    expect(byKey.get("11:value")).toBe(24);
    expect(byKey.get("17:value")).toBe(194);
    expect(byKey.get("39:max_frames")).toBe(194);
    expect(byKey.get("49:max_frames")).toBe(194);
    expect(byKey.get("58:max_frames")).toBe(194);
    expect(byKey.get("70:frame_rate")).toBe(24);
    expect(result.data.workflowType).toBe("ltx");
    expect(result.data.motionProfile).toBe("balanced");
  });
});