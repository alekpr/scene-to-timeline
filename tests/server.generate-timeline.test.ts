import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { createServer } from "http";
import { app } from "../src/server";

const PORT = 3334;

vi.mock("../src/core/analyzer", () => ({
  analyzeScene: vi.fn().mockResolvedValue([
    { description: "test segment 1", duration: 0.4 },
    { description: "test segment 2", duration: 0.6 },
  ]),
}));

vi.mock("../src/core/builder", () => ({
  buildTimelinePayload: vi.fn().mockReturnValue({
    globalPrompt: "test global prompt",
    localPrompts: "prompt1|prompt2",
    segmentLengths: "80|120",
    maxFrames: 200,
    summary: {
      segmentCount: 2,
    },
    timelineData: {
      segments: [
        { prompt: "test segment 1", length: 80, color: "#FF0000" },
        { prompt: "test segment 2", length: 120, color: "#00FF00" },
      ],
    },
  }),
}));

describe("server route: generate-timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("respects ltx as default workflowType when omitted", async () => {
    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
    });

    try {
      const originalFetch = global.fetch;
      const response = await originalFetch(
        `http://127.0.0.1:${PORT}/api/generate-timeline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene: "A courier runs through rain",
            duration: 8,
            // workflowType intentionally omitted to test default
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        data: {
          payload: Record<string, unknown>;
          summary: {
            fps: number;
            maxFrames: number;
            segmentCount: number;
          };
        };
      };

      expect(data.success).toBe(true);
      // LTX defaults to fps=24 when omitted
      expect(data.data.summary.fps).toBe(24);
      expect(data.data.summary.maxFrames).toBeGreaterThan(0);
      expect(data.data.summary.segmentCount).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it("respects explicit workflowType=wan legacy path", async () => {
    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
    });

    try {
      const originalFetch = global.fetch;
      const response = await originalFetch(
        `http://127.0.0.1:${PORT}/api/generate-timeline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene: "A courier runs through rain",
            duration: 8,
            workflowType: "wan",
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        data: {
          payload: Record<string, unknown>;
          summary: {
            fps: number;
            maxFrames: number;
            segmentCount: number;
          };
        };
      };

      expect(data.success).toBe(true);
      // Wan uses fps from validator default (24 if not overridden)
      expect(data.data.summary.fps).toBeGreaterThan(0);
      expect(data.data.summary.maxFrames).toBeGreaterThan(0);
      expect(data.data.summary.segmentCount).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it("preserves explicit fps override across workflow types", async () => {
    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
    });

    try {
      const originalFetch = global.fetch;
      const response = await originalFetch(
        `http://127.0.0.1:${PORT}/api/generate-timeline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene: "A courier runs through rain",
            duration: 8,
            fps: 20,
            workflowType: "ltx",
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        data: {
          payload: Record<string, unknown>;
          summary: {
            fps: number;
            maxFrames: number;
            segmentCount: number;
          };
        };
      };

      expect(data.success).toBe(true);
      // Explicit fps should override workflow default
      expect(data.data.summary.fps).toBe(20);
      expect(data.data.summary.maxFrames).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });
});
