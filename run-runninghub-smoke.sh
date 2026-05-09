#!/bin/bash
# Smoke test helper for RunningHub workflow stability across motion profiles.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SCENE_FILE="${SCENE_FILE:-examples/hacker-control-room.txt}"
TRANSCRIPT_FILE="${TRANSCRIPT_FILE:-examples/hacker-voiceover.txt}"
IMAGE_FILE="${IMAGE_FILE:-}"
DURATION="${DURATION:-8}"
FPS="${FPS:-}"
WORKFLOW_TYPE="${WORKFLOW_TYPE:-ltx}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
MAX_POLLS="${MAX_POLLS:-360}"

if [[ -z "$FPS" ]]; then
  FPS="24"
fi

if [[ ! -f "$SCENE_FILE" ]]; then
  echo "Missing scene file: $SCENE_FILE"
  exit 1
fi

if [[ ! -f "$TRANSCRIPT_FILE" ]]; then
  echo "Missing transcript file: $TRANSCRIPT_FILE"
  exit 1
fi

if [[ -z "$IMAGE_FILE" ]]; then
  echo "IMAGE_FILE is required"
  echo "Example: IMAGE_FILE=./your-reference.jpg npm run smoke:runninghub"
  exit 1
fi

if [[ ! -f "$IMAGE_FILE" ]]; then
  echo "Missing image file: $IMAGE_FILE"
  echo "Set IMAGE_FILE=/path/to/image.jpg and rerun."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required"
  exit 1
fi

mkdir -p outputs

encode_image_data_uri() {
  local image_path="$1"
  local ext
  ext="${image_path##*.}"
  ext="${ext,,}"

  local media_type
  if [[ "$ext" == "png" ]]; then
    media_type="image/png"
  else
    media_type="image/jpeg"
  fi

  local base64_payload
  base64_payload="$(base64 < "$image_path" | tr -d '\n')"
  printf "data:%s;base64,%s" "$media_type" "$base64_payload"
}

read_json_field() {
  local json_input="$1"
  local field_path="$2"
  printf "%s" "$json_input" | node -e '
const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
const path = process.argv[1].split(".");
let obj;
try {
  obj = JSON.parse(input);
} catch {
  process.exit(2);
}
let cur = obj;
for (const key of path) {
  if (cur == null || !(key in cur)) {
    process.exit(3);
  }
  cur = cur[key];
}
if (typeof cur === "object") {
  process.stdout.write(JSON.stringify(cur));
} else {
  process.stdout.write(String(cur));
}
' "$field_path" || true
}

run_profile() {
  local profile="$1"
  local scene transcript image_data_uri payload create_resp task_id
  scene="$(cat "$SCENE_FILE")"
  transcript="$(cat "$TRANSCRIPT_FILE")"
  image_data_uri="$(encode_image_data_uri "$IMAGE_FILE")"

  payload="$(node -e '
const fs = require("fs");
const [scene, transcript, duration, fps, profile, imageData, workflowType] = process.argv.slice(1);
const payload = {
  scene,
  duration: Number(duration),
  fps: Number(fps),
  transcript,
  workflowType,
  motionProfile: profile,
  image: imageData,
};
process.stdout.write(JSON.stringify(payload));
' "$scene" "$transcript" "$DURATION" "$FPS" "$profile" "$image_data_uri" "$WORKFLOW_TYPE")"

  echo ""
  echo "=== Profile: $profile ==="
  echo "Submitting task..."

  create_resp="$(curl -sS -X POST "$BASE_URL/api/generate-and-run-runninghub" \
    -H "Content-Type: application/json" \
    -d "$payload")"

  printf "%s\n" "$create_resp" > "outputs/smoke-${profile}-create.json"

  task_id="$(read_json_field "$create_resp" "data.taskId")"
  if [[ -z "$task_id" ]]; then
    echo "Failed to create task for profile $profile"
    echo "Saved raw response: outputs/smoke-${profile}-create.json"
    return 1
  fi

  echo "Task ID: $task_id"
  echo "Polling status..."

  local status_resp output_resp
  for ((i=1; i<=MAX_POLLS; i++)); do
    status_resp="$(curl -sS -X POST "$BASE_URL/api/runninghub/task-status" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\":\"$task_id\"}")"
    printf "%s\n" "$status_resp" > "outputs/smoke-${profile}-status.json"

    local status_text
    status_text="$(read_json_field "$status_resp" "data.taskStatus")"
    if [[ -z "$status_text" ]]; then
      status_text="$(read_json_field "$status_resp" "data.status")"
    fi

    echo "Poll $i/$MAX_POLLS status: ${status_text:-unknown}"

    if [[ "$status_text" == "SUCCESS" || "$status_text" == "success" || "$status_text" == "COMPLETED" || "$status_text" == "completed" ]]; then
      output_resp="$(curl -sS -X POST "$BASE_URL/api/runninghub/task-output" \
        -H "Content-Type: application/json" \
        -d "{\"taskId\":\"$task_id\"}")"
      printf "%s\n" "$output_resp" > "outputs/smoke-${profile}-output.json"

      local file_url
      file_url="$(read_json_field "$output_resp" "data.0.fileUrl")"
      echo "Completed. Output URL: ${file_url:-not found in response}"
      return 0
    fi

    if [[ "$status_text" == "FAILED" || "$status_text" == "failed" || "$status_text" == "ERROR" || "$status_text" == "error" || "$status_text" == "CANCELLED" || "$status_text" == "cancelled" ]]; then
      echo "Task ended with failure state: $status_text"
      return 1
    fi

    sleep "$POLL_INTERVAL"
  done

  echo "Polling timeout for profile $profile"
  return 1
}

main() {
  local profiles=("fast" "balanced" "cinematic")
  if [[ "$WORKFLOW_TYPE" == "ltx" ]]; then
    profiles+=("template-like")
  fi
  local failed=0

  echo "Running smoke test against $BASE_URL"
  echo "Scene: $SCENE_FILE"
  echo "Transcript: $TRANSCRIPT_FILE"
  echo "Image: $IMAGE_FILE"
  echo "Duration: $DURATION"
  echo "FPS: $FPS"
  echo "Workflow Type: $WORKFLOW_TYPE"

  for profile in "${profiles[@]}"; do
    if ! run_profile "$profile"; then
      failed=1
      echo "Profile $profile failed"
    fi
  done

  echo ""
  if [[ $failed -eq 0 ]]; then
    echo "Smoke test completed: all profiles succeeded"
    exit 0
  fi

  echo "Smoke test completed: at least one profile failed"
  exit 1
}

main