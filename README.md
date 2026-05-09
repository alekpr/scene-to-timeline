# Scene to Timeline

CLI tool for converting scene descriptions into Prompt Relay Encode (Timeline) fields for ComfyUI.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Add your API key in `.env`:

```env
ANTHROPIC_API_KEY=your_key
```

## Run

First, setup your environment:

```bash
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=your_actual_key
```

Then run the CLI with scene and duration:

```bash
npm run dev -- --scene "A woman walks in a neon alley" --duration 10
```

Optional image:

```bash
npm run dev -- --scene "A woman walks in a neon alley" --duration 10 --image ./reference.jpg
```

Optional voiceover transcript (aligns visuals to speech):

```bash
npm run dev -- --scene "A woman walks in a neon alley" --duration 10 --transcript "She walks down the dark street, thinking about what comes next. A reflection catches her eye."
```

Both image and transcript:

```bash
npm run dev -- --scene "A woman walks in a neon alley" --duration 10 --image ./reference.jpg --transcript "She walks..."
```

**Phase 2 — Advanced Options**

Custom FPS (default: 24):

```bash
npm run dev -- --scene "..." --duration 12 --fps 30
```

Override segment count (default: duration/3):

```bash
npm run dev -- --scene "..." --duration 12 --segments 6
```

Save output to JSON file:

```bash
npm run dev -- --scene "..." --duration 12 --output timeline.json
```

Show timeline preview in terminal:

```bash
npm run dev -- --scene "..." --duration 12 --preview
```

Combine all options:

```bash
npm run dev -- --scene "..." --duration 12 --fps 30 --segments 5 --image ref.jpg --transcript "VO..." --output result.json --preview
```

**Pipe scene from stdin:**

```bash
cat scene.txt | npm run dev -- --duration 12
```

**Pipe both scene and voiceover:**

```bash
cat scene.txt | npm run dev -- --duration 12 --transcript "$(cat voiceover.txt)"
```

Disable clipboard copy:

```bash
npm run dev -- --scene "..." --duration 12 --no-copy
```

### Example: Hacker Control Room Scene (with voiceover)

To test with a more complex scene, use the included fixture:

```bash
npm run dev -- --scene "A dark, cluttered control room or hacker's den. Multiple monitors display stock market crashes, chaotic news feeds, and maps with spreading red alerts." --duration 12 --transcript "A shadowy figure whispers urgently about the spreading crisis. Markets are collapsing worldwide."
```

Or create a file `scene.txt` and pass it in:

```bash
npm run dev -- --scene "$(cat scene.txt)" --duration 12 --no-copy
```

Quick test with included example:

```bash
chmod +x run-hacker-example.sh
./run-hacker-example.sh
```

## Test

Unit tests (no API required):

```bash
npm test
```

Integration tests with Anthropic API:

```bash
# Setup .env with ANTHROPIC_API_KEY
cp .env.example .env
# Edit .env and add your key

# Run integration tests
INTEGRATION_TEST=1 npm run test:integration

# Or use the helper script
chmod +x test-with-api.sh
source .env && ./test-with-api.sh
```

## Build

```bash
npm run build
```

## Motion Tuning Playbook

เอกสารสรุปการจูน motion รอบนี้สำหรับนำไป reuse กับโปรเจกต์อื่น:

- [docs/motion-tuning-playbook.md](docs/motion-tuning-playbook.md)
- [docs/runninghub-qa-checklist.md](docs/runninghub-qa-checklist.md)

---

## **Phase 3 — Web UI** 🌐

A modern web interface for timeline generation with drag-and-drop image upload, visual timeline preview, and one-click field copying.

### Start the Web Server

```bash
npm run dev:web
```

The UI will be available at **http://localhost:3000**

### Web UI Features

✨ **Interactive Form**
- Scene description textarea (Thai/English support)
- Duration input (seconds)
- Optional FPS override
- RunningHub workflow selector: `wan`, `ltx`
- Optional segment count override
- Optional voiceover transcript
- Optional reference image via drag-and-drop or file picker
- RunningHub motion profile selector: `fast`, `balanced`, `cinematic`

📊 **Real-time Results**
- Global prompt for the scene
- Local prompts (segment-by-segment breakdown)
- Segment lengths and max frames
- Raw timeline JSON data

📈 **Visual Timeline Preview**
- ASCII-art timeline in terminal style
- Percentage breakdown per segment
- Frame counts and assigned colors
- Interactive preview box

📋 **One-Click Copy**
- Copy each field individually to clipboard
- Copy entire JSON payload
- Feedback message on successful copy

### API Endpoint

Post your data directly to the REST API:

```bash
curl -X POST http://localhost:3000/api/generate-timeline \
  -H "Content-Type: application/json" \
  -d '{
    "scene": "A mysterious figure in fog at a cliff edge",
    "duration": 8,
    "workflowType": "ltx",
    "fps": 24,
    "segments": 3,
    "transcript": "Optional voiceover text",
    "image": "data:image/jpeg;base64,...",
    "preview": true
  }'
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "payload": {
      "globalPrompt": "...",
      "localPrompts": "...",
      "segmentLengths": "72 | 48 | 72",
      "maxFrames": 192,
      "timelineData": {
        "segments": [...]
      },
      "summary": {
        "durationSeconds": 8,
        "fps": 24,
        "segmentCount": 3
      }
    },
    "previewOutput": "...",
    "summary": {...}
  }
}
```

### RunningHub Motion Profiles

When using the cloud workflow endpoint, the app now injects sampler presets automatically instead of forcing one fixed sampler configuration.

Current rollout status:

- `ltx` is now the default workflow in the UI and smoke script.
- `wan` remains available as a legacy option through `workflowType: "wan"`.

| Profile | KSampler Steps | CFG | Intended Use |
|---|---:|---:|---|
| `fast` | 8 / 8 | 1.0 | Restored to the original workflow reference sampler settings |
| `balanced` | 8 / 8 | 1.0 | Restored to the original workflow reference sampler settings |
| `cinematic` | 8 / 8 | 1.0 | Temporarily aligned with the original workflow reference for stability |
| `template-like` | LTX experimental | LTX experimental | Template-inspired LTX tuning (best for realism A/B tests on LTX) |

The profile is applied to RunningHub nodes `73` and `83` during request mapping. Timeline frame counts now stay exactly aligned with `maxFrames` from the generated payload.

### RunningHub Endpoint

To generate a timeline and immediately run the configured workflow on RunningHub:

```bash
curl -X POST http://localhost:3000/api/generate-and-run-runninghub \
  -H "Content-Type: application/json" \
  -d '{
    "scene": "A masked courier sprints through rain, vaults a barrier, and slides into neon light",
    "duration": 8,
    "fps": 24,
    "workflowType": "ltx",
    "motionProfile": "cinematic",
    "image": "data:image/jpeg;base64,..."
  }'
```

`workflowType` is optional. If omitted, the server uses `ltx`. For `wan` (legacy), set `RUNNINGHUB_WORKFLOW_ID` in `.env`. For `ltx`, set `RUNNINGHUB_LTX_WORKFLOW_ID` in `.env`.

`motionProfile` is optional. If omitted or invalid, the server falls back to `balanced`.

### RunningHub Smoke Test (Recommended After Changes)

Run the end-to-end smoke test for all motion profiles.

- `wan`: `fast`, `balanced`, `cinematic`
- `ltx`: `fast`, `balanced`, `cinematic`, `template-like`

```bash
npm run smoke:runninghub
```

Prerequisites:

- Start server first: `npm run dev:web`
- Provide a valid image file path via `IMAGE_FILE=...`
- Ensure RunningHub credentials are present in `.env`
- For LTX runs, set `RUNNINGHUB_LTX_WORKFLOW_ID` in `.env`

Override defaults with env vars when needed:

```bash
IMAGE_FILE=./your-frame.jpg DURATION=8 FPS=24 WORKFLOW_TYPE=ltx npm run smoke:runninghub
```

Artifacts are saved under `outputs/` as:

- `smoke-<profile>-create.json`
- `smoke-<profile>-status.json`
- `smoke-<profile>-output.json`

### Development

- Backend: Express.js (TypeScript)
- Frontend: HTML5 + CSS3 + Vanilla JavaScript
- Static serving from `public/` directory
- CORS enabled for cross-origin requests
