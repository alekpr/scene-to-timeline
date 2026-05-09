# Scene-to-Timeline Tool — แผนการพัฒนา

## ภาพรวมโปรเจกต์

Tool นี้รับ input จากผู้ใช้ แล้วใช้ AI วิเคราะห์และสร้าง output เป็น text ที่พร้อม copy ไปใส่ใน **Prompt Relay Encode (Timeline)** node ใน ComfyUI workflow ได้ทันที โดยไม่ต้องเชื่อมต่อกับ ComfyUI โดยตรงในเฟสแรก

---

## Input ที่รับเข้าระบบ

| # | Field | Type | Required | คำอธิบาย |
|---|-------|------|----------|-----------|
| 1 | `scene_overview` | `string` | ✅ | ข้อความอธิบายภาพรวมของ scene ทั้งหมด |
| 2 | `duration_seconds` | `number` | ✅ | ความยาววิดีโอที่ต้องการ (หน่วย: วินาที) |
| 3 | `reference_image` | `file` (jpg/png) | ⬜ Optional | ภาพสำหรับ Image-to-Video anchor |

---

## Output ที่ต้องการ (Phase 1)

Output ของ tool คือ **text ที่ผู้ใช้ copy-paste** ไปใส่ใน ComfyUI เอง ประกอบด้วยส่วนต่างๆ ดังนี้

### ตัวอย่าง Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PROMPT RELAY ENCODE (TIMELINE) — OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[GLOBAL PROMPT]
→ ใส่ใน field: global_prompt
──────────────────────────────────────
A cinematic medium shot, warm afternoon light, elderly Japanese man in a small
tea shop, wooden interior, dust particles in sunlight, film grain aesthetic

[LOCAL PROMPTS]
→ ใส่ใน field: local_prompts  (คั่นด้วย | )
──────────────────────────────────────
The old man sits still, looking at a teacup on the table | He slowly reaches out and picks up the cup | He takes a gentle sip, closing his eyes | He sets the cup down and smiles faintly, gazing out the window

[SEGMENT LENGTHS]
→ ใส่ใน field: segment_lengths  (คั่นด้วย | )
──────────────────────────────────────
72 | 72 | 72 | 72

[MAX FRAMES]
→ ใส่ใน field: max_frames
──────────────────────────────────────
288

[TIMELINE DATA JSON]
→ ใส่ใน field: timeline_data
──────────────────────────────────────
{"segments":[{"prompt":"The old man sits still, looking at a teacup on the table","length":72,"color":"#4f8edc"},{"prompt":"He slowly reaches out and picks up the cup","length":72,"color":"#e07b3a"},{"prompt":"He takes a gentle sip, closing his eyes","length":72,"color":"#d9534f"},{"prompt":"He sets the cup down and smiles faintly, gazing out the window","length":72,"color":"#5cb85c"}]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration   : 12 วินาที
Segments   : 4 segments (~3 วินาที/segment)
FPS        : 24
Max Frames : 288
```

---

## สถาปัตยกรรมระบบ

```
┌─────────────────────────────────────────────────┐
│                   CLI / Web UI                  │
│  scene_overview + duration + image (optional)   │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│              Input Validator                    │
│  - validate duration > 0                        │
│  - validate scene_overview not empty            │
│  - load & encode image to base64 (if provided)  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│           AI Scene Analyzer (Claude API)        │
│                                                 │
│  Input:                                         │
│    - scene_overview (text)                      │
│    - duration_seconds (number)                  │
│    - reference_image (base64, optional)         │
│    - calculated segment count                   │
│                                                 │
│  Output: structured JSON                        │
│    - global_prompt                              │
│    - segments[]: { prompt, weight }             │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│           Timeline Payload Builder              │
│                                                 │
│  - คำนวณ max_frames = duration × fps            │
│  - คำนวณ segment_lengths จาก weight ratio       │
│  - สร้าง timeline_data JSON                     │
│  - เลือก color palette สำหรับแต่ละ segment      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│              Output Formatter                   │
│  - render เป็น human-readable text              │
│  - แสดงผลใน terminal / copy box                 │
└─────────────────────────────────────────────────┘
```

---

## โครงสร้าง Project (Node.js)

```
scene-to-timeline/
├── src/
│   ├── index.js              # entry point (CLI)
│   ├── validator.js          # validate & prepare input
│   ├── analyzer.js           # Claude API call + prompt engineering
│   ├── builder.js            # แปลง AI output → timeline payload
│   ├── formatter.js          # render output text สำหรับ copy
│   └── utils/
│       ├── imageLoader.js    # load image → base64
│       ├── colorPalette.js   # เลือกสี segment อัตโนมัติ
│       └── framesCalc.js     # คำนวณ frames จาก duration
├── .env                      # ANTHROPIC_API_KEY
├── package.json
└── README.md
```

---

## AI Prompt Engineering

### หลักการออกแบบ Prompt

AI ต้องรู้ข้อมูลต่อไปนี้เพื่อสร้าง segment ที่ดี

1. **Segment แรก** ควร establish ภาพรวมที่มองเห็น และถ้าฉากเป็น dynamic scene สามารถใส่ anticipatory motion ได้
2. **Segment ถัดไป** บอกเฉพาะ action/motion ที่เปลี่ยนแปลง ไม่ซ้ำองค์ประกอบ static โดยไม่จำเป็น
3. **ความยาว segment** ควรอยู่ที่ 2–5 วินาที ต่อ segment
4. **global_prompt** ครอบคลุม style, character, environment ที่คงที่ตลอดวิดีโอ
5. prompt ควรใช้คำกริยาเชิง cinematic ที่สื่อ speed, direction, intensity เพื่อให้ motion ชัดขึ้น

### System Prompt Template (ส่งให้ Claude API)

```
You are a cinematographer and video prompt engineer specializing in AI video generation.
Your task is to analyze a scene description and break it down into temporal segments
for use with the Prompt Relay Encode (Timeline) node in ComfyUI.

Rules:
- Segment 1 should establish the visible state, and may include subtle anticipatory motion if the scene is dynamic
- Subsequent segments describe ONLY what changes — do not repeat static elements unless continuity would be lost
- Keep each segment 2-5 seconds (you will receive target duration and segment count)
- global_prompt must contain: shot type, lighting, subject, environment, style/aesthetic
- Each segment prompt should stay concise but vivid, usually 20-35 words
- Use cinematic motion language when movement matters: speed, direction, intensity, camera movement
- Assign a weight (1-10) to each segment based on how much time it deserves and how motion-heavy it is

If a reference image is provided, use it to anchor the visual style and subject appearance
in your global_prompt and segment 1 description.

Respond ONLY in valid JSON format:
{
  "global_prompt": "...",
  "segments": [
    { "prompt": "...", "weight": 3 },
    { "prompt": "...", "weight": 2 }
  ]
}
```

### User Message Template

```
Scene overview: {scene_overview}
Total duration: {duration_seconds} seconds
Target segments: {segment_count} (approx. {seconds_per_segment}s each)
Reference image: {attached or "none"}

Generate the timeline breakdown now.
```

### Motion Strategy ที่เพิ่มเข้ามา

ระบบรุ่นปัจจุบันเพิ่ม logic ฝั่ง app และ RunningHub เพื่อให้ video เคลื่อนไหวชัดขึ้น:

1. **Motion-aware prompt generation**
  - analyzer จะชี้นำให้ใช้คำกริยาเชิง action มากขึ้น
  - segment แรกไม่ถูกบังคับให้นิ่งล้วนอีกต่อไป

2. **Motion-aware segment inference**
  - ฉากที่มี action-heavy keywords จะถูก bias ให้มี segment มากขึ้น
  - ฉากนิ่งจะยังคง pacing แบบช้าและยาวกว่า

3. **Static opener rebalancing**
  - ถ้า segment แรกไม่มี motion verb ชัด ระบบจะกด weight ลงเล็กน้อย
  - เฟรมที่เหลือจะถูกย้ายไปยัง segment ที่มี action มากกว่า

4. **RunningHub motion profiles**
  - `fast`: steps 8/8, cfg 2.5
  - `balanced`: steps 10/10, cfg 3.0
  - `cinematic`: steps 12/12, cfg 3.5
  - profile จะถูก map ไปยัง KSampler nodes 73 และ 83 แบบอัตโนมัติ

5. **Frame parity กับ workflow**
  - `maxFrames` และ `length` ที่ส่งไป RunningHub จะตรงกับ payload แล้ว
  - ตัดปัญหา off-by-one ที่เคยทำให้ timeline drift ลง workflow

---

## การคำนวณ Frames

| Parameter | สูตร | ตัวอย่าง (12 วินาที, 24fps) |
|-----------|------|-----------------------------|
| `max_frames` | `duration × fps` | `12 × 24 = 288` |
| `segment_count` | `Math.round(duration / 3)` | `12 / 3 = 4 segments` |
| `segment_lengths` | `(weight / totalWeight) × max_frames` | เฉลี่ยเท่ากัน = `72 each` |

> **หมายเหตุ:** `segment_lengths` ใน Prompt Relay ใช้ "pixel-space frames" ซึ่งโดยทั่วไปตรงกับ frame count ที่ 24fps ควรทดสอบกับ LTX 2.3 จริงเพื่อยืนยัน

---

## Dependencies ที่ต้องใช้

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.x.x",
    "sharp": "^0.x.x",
    "commander": "^12.x.x",
    "chalk": "^5.x.x",
    "clipboardy": "^4.x.x"
  }
}
```

| Package | ใช้ทำอะไร |
|---------|-----------|
| `@anthropic-ai/sdk` | เรียก Claude API |
| `sharp` | โหลดและ resize image ก่อน encode base64 |
| `commander` | สร้าง CLI interface |
| `chalk` | ตกแต่ง output ใน terminal |
| `clipboardy` | copy output ไป clipboard อัตโนมัติ |

---

## CLI Usage (เป้าหมาย)

```bash
# แบบ text only (ไม่มีรูป)
node index.js \
  --scene "ชายชราคนหนึ่งนั่งอยู่ในร้านชา เขากำลังจะดื่มชา ก่อนจะตระหนักว่ามีแมวกระโดดขึ้นมาบนโต๊ะ" \
  --duration 15

# แบบมีรูป reference
node index.js \
  --scene "A woman walks through a neon-lit alley at night, stops to look at a reflection in a puddle" \
  --duration 10 \
  --image ./reference.jpg

# ระบุ fps เอง (default: 24)
node index.js --scene "..." --duration 12 --fps 24
```

---

## แผนการพัฒนา (Phases)

### Phase 1 — Core CLI Tool ✅ เป้าหมายแรก

- [x] รับ input 3 อย่างผ่าน CLI args
- [x] ส่ง image (ถ้ามี) ไปพร้อมกับ text ให้ Claude API วิเคราะห์
- [x] แปลง AI output → timeline payload
- [x] แสดงผลเป็น formatted text ใน terminal
- [x] มีปุ่ม/คำสั่ง copy to clipboard

### Phase 2 — Quality of Life

- [ ] Validation และ error message ที่ชัดเจน
- [ ] `--preview` mode แสดง segment timeline แบบ visual ใน terminal
- [ ] รองรับ output เป็น JSON file (`--output result.json`)
- [ ] รองรับ input จาก stdin (pipe)
- [ ] เพิ่ม `--fps` flag
- [ ] เพิ่ม `--segments` flag สำหรับกำหนดจำนวน segment เอง

### Phase 3 — Web UI (Optional)

- [ ] สร้าง simple web interface ด้วย Express.js
- [ ] Drag & drop image upload
- [ ] แสดง timeline preview แบบ visual
- [ ] One-click copy แต่ละ field

---

## ข้อจำกัดและสิ่งที่ต้องทดสอบ

| ประเด็น | รายละเอียด |
|---------|-----------|
| **timeline_data JSON format** | format ตามที่ reverse-engineer จาก example workflow ของ kijai ต้องทดสอบว่า ComfyUI รับได้ |
| **pixel-space frames vs actual frames** | ต้องทดสอบกับ LTX 2.3 จริงว่า ratio ถูกต้อง |
| **Image size limit** | Claude API รับ image ขนาดสูงสุด 5MB ควร resize ก่อนส่ง |
| **Segment count สำหรับ video สั้น** | วิดีโอ < 5 วินาที อาจมีแค่ 1-2 segments ต้อง handle edge case |

---

## ตัวอย่าง Output จริงที่คาดหวัง

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SCENE-TO-TIMELINE TOOL  |  v0.1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Scene    : A woman walks through a neon-lit alley...
  Duration : 10s  |  FPS: 24  |  Segments: 4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] GLOBAL PROMPT  →  ใส่ใน: global_prompt
────────────────────────────────────────────────
A cinematic wide shot, cyberpunk neon-lit alleyway at night, rain-slicked
ground, vibrant reflections, young woman in dark coat, moody cinematic aesthetic

[2] LOCAL PROMPTS  →  ใส่ใน: local_prompts
────────────────────────────────────────────────
A woman stands at the alley entrance, coat glistening under neon lights |
She walks slowly forward, heels echoing on wet pavement |
She stops abruptly, looking down at a puddle reflection |
She kneels and stares at her reflection, expression shifting to wonder

[3] SEGMENT LENGTHS  →  ใส่ใน: segment_lengths
────────────────────────────────────────────────
60 | 60 | 60 | 60

[4] MAX FRAMES  →  ใส่ใน: max_frames
────────────────────────────────────────────────
240

[5] TIMELINE DATA  →  ใส่ใน: timeline_data
────────────────────────────────────────────────
{"segments":[{"prompt":"A woman stands at the alley entrance, coat glistening
under neon lights","length":60,"color":"#4f8edc"},{"prompt":"She walks slowly
forward, heels echoing on wet pavement","length":60,"color":"#e07b3a"},
{"prompt":"She stops abruptly, looking down at a puddle reflection","length":60,
"color":"#d9534f"},{"prompt":"She kneels and stares at her reflection, expression
shifting to wonder","length":60,"color":"#5cb85c"}]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Copied to clipboard!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## สรุป

Tool นี้มีความเป็นไปได้สูงมากในการพัฒนา เพราะ:

1. **ทุก component มีอยู่แล้ว** — Claude API รองรับ vision, Prompt Relay มี documented input format
2. **Scope Phase 1 เล็กและชัดเจน** — ไม่ต้องเชื่อมต่อ ComfyUI โดยตรง แค่ generate text ให้ copy
3. **ขยายได้ในอนาคต** — Phase 2-3 สามารถเพิ่ม ComfyUI API integration, Web UI, batch processing ได้

ขั้นตอนถัดไปที่แนะนำ: เริ่มจากเขียน `analyzer.js` และทดสอบ AI output ก่อน แล้วค่อย build ส่วนอื่นตาม
