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

Disable clipboard copy:

```bash
npm run dev -- --scene "..." --duration 12 --no-copy
```

## Test

```bash
npm test
```

## Build

```bash
npm run build
```
