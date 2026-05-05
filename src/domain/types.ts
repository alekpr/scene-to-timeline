export interface CliOptions {
  scene?: string;
  duration?: string;
  image?: string;
  transcript?: string;
  copy?: boolean;
}

export interface ValidatedInput {
  sceneOverview: string;
  durationSeconds: number;
  fps: number;
  referenceImage?: {
    base64: string;
    mediaType: "image/jpeg" | "image/png";
    originalPath: string;
  };
  voiceoverTranscript?: string;
}

export interface SceneSegment {
  prompt: string;
  weight: number;
}

export interface AnalyzerResult {
  global_prompt: string;
  segments: SceneSegment[];
}

export interface TimelineSegment {
  prompt: string;
  length: number;
  color: string;
}

export interface TimelinePayload {
  globalPrompt: string;
  localPrompts: string;
  segmentLengths: string;
  maxFrames: number;
  timelineData: {
    segments: TimelineSegment[];
  };
  summary: {
    durationSeconds: number;
    fps: number;
    segmentCount: number;
  };
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
