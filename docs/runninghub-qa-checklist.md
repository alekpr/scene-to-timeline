# RunningHub QA Checklist

Use this checklist after any workflow, sampler, mapping, or prompt-logic change.

## Scope

- Confirm output is not black.
- Confirm motion and pacing match the intended scene.
- Confirm generated timeline fields still map correctly to RunningHub nodes.
- Confirm the selected workflow path (`wan` or `ltx`) is using the intended defaults.

## Pre-flight

- Server is running: `npm run dev:web`.
- `.env` contains valid `RUNNINGHUB_API_KEY`.
- `.env` contains the workflow id for the path you are testing:
  - `RUNNINGHUB_WORKFLOW_ID` for `wan`
  - `RUNNINGHUB_LTX_WORKFLOW_ID` for `ltx`
- Reference image exists and is valid JPG/PNG.
- Baseline scene and transcript are fixed for repeatability.

## Workflow Baselines

- `wan`
  - Width/height baseline: `720x1280`
  - Frame semantics: inclusive mapping (`maxFrames + 1`)
  - Smoke default fps: `24`
- `ltx`
  - Width/height baseline: `576x1024`
  - Frame semantics: inclusive mapping (`maxFrames + 1`)
  - Smoke default fps: `24`

## Quick Smoke (3 profiles)

Wan path:

```bash
IMAGE_FILE=./your-reference.jpg npm run smoke:runninghub
```

LTX path:

```bash
IMAGE_FILE=./your-reference.jpg WORKFLOW_TYPE=ltx npm run smoke:runninghub
```

Pass criteria:

- `fast`, `balanced`, `cinematic` complete successfully.
- Each profile returns a playable output URL.
- No black output at start, middle, or end.
- Frame-rate and frame-count behavior match the selected workflow baseline.

Artifacts to keep:

- `outputs/smoke-fast-create.json`
- `outputs/smoke-fast-status.json`
- `outputs/smoke-fast-output.json`
- `outputs/smoke-balanced-create.json`
- `outputs/smoke-balanced-status.json`
- `outputs/smoke-balanced-output.json`
- `outputs/smoke-cinematic-create.json`
- `outputs/smoke-cinematic-status.json`
- `outputs/smoke-cinematic-output.json`

## Visual QA

For each output, score 1-5:

- Motion clarity: subject and camera movement are readable.
- Pacing: transitions align with narration beats.
- Stability: no severe flicker, freeze, or sudden corruption.
- Composition continuity: subject and framing remain coherent.

Minimum acceptable release bar:

- No black frames.
- No failed task.
- Average score >= 3.5 across the 4 visual criteria.

## Regression Checks

Run focused tests:

```bash
npm test -- tests/runninghub.test.ts tests/ltxRunninghub.test.ts tests/runninghubWorkflow.test.ts tests/server.ltx-route.test.ts
```

Expected:

- Wan node mapping tests pass.
- LTX node mapping tests pass.
- Shared workflow execution planning tests pass.
- LTX route contract test passes.

## If A Failure Happens

- If all profiles fail: verify API key, workflow id, and image upload mapping first.
- If only one workflow fails: compare the selected workflow type, workflow id, fps default, and node mapping before tuning prompts.
- If only one profile fails: compare sampler and stage overrides in request logs.
- If output is non-black but low quality: tune one variable at a time from baseline.
- Always keep one untouched baseline run for side-by-side comparison.
