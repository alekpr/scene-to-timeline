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
