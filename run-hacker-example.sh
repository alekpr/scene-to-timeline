#!/bin/bash
# Example: Run the hacker control room scene with voiceover

set -e

SCENE=$(cat examples/hacker-control-room.txt)
VOICEOVER=$(cat examples/hacker-voiceover.txt)

echo "🎬 Testing Scene-to-Timeline with Hacker Control Room scene..."
echo ""

npm run dev -- \
  --scene "$SCENE" \
  --duration 12 \
  --transcript "$VOICEOVER"
