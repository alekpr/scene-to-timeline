# Motion Tuning Playbook (Scene-to-Timeline)

เอกสารนี้สรุปแนวทางการจูนเพื่อเพิ่ม movement และ temporal coherence ให้ video ที่สร้างจาก pipeline แนว PromptRelay + RunningHub โดยรอบล่าสุดเน้น LTX2.3 (และเก็บ Wan เป็น legacy) พร้อมขั้นตอนที่นำไปใช้กับโปรเจกต์อื่นได้

## 1) เป้าหมายของการจูน

- เพิ่มความรู้สึกว่า "มี action" มากขึ้น ไม่ใช่แค่ micro movement
- ลดอาการ segment ต่อกันแล้ว motion ขาดตอน
- รักษา frame parity ให้ timeline ที่สร้างตรงกับ workflow cloud
- ให้จูนได้เป็น profile (`fast`, `balanced`, `cinematic`, `template-like`) เพื่อเลือกตามเป้าหมายคุณภาพ

## 2) ปัญหาที่พบในรอบนี้

- Sampler steps ต่ำเกินไป ทำให้ motion synthesis ออกมาน้อย
- CFG ต่ำเกินไป ทำให้ prompt คุม action ไม่ค่อยติด
- Segment opener มัก static เกินไป ทำให้เสียเฟรมช่วงต้นกับภาพนิ่ง
- การจัดเฟรมเดิมมองแค่ weight แต่ยังไม่ลงโทษ segment static
- เคยมี frame mapping mismatch ตอนส่งขึ้น cloud (off-by-one)
- พบว่า `cinematic` ใน LTX2.3 ให้ภาพสวยแต่ continuity แย่ในหลายซีน (over-stylized motion)
- มีเคสโดน RunningHub moderation (`Politics`) เมื่อ prompt พูดถึง politician/deepfake ในบริบทการเมือง

## 3) จุดจูนหลักที่ให้ผลสูงสุด

### 3.1 Workflow/Sampler Layer (LTX2.3 ล่าสุด)

ผลทดสอบล่าสุด (May 2026):

- `balanced` ให้ temporal coherence ดีสุด และเป็น default ที่เหมาะกับ production
- `template-like` คุณภาพสูสีกับ `balanced` และให้ลุคนุ่มกว่าในบางซีน
- `cinematic` เดิมพยายามมากไป ทำให้เฟรมต่อกันไม่เนียน จึงแนะนำปรับเป็น `cinematic-lite`

ค่า preset ที่ใช้จริงในโค้ดปัจจุบัน:

| Profile | Stage1 CFG | Stage2 CFG | Stage3 CFG | imageStrength | samplerName | หมายเหตุ |
|---|---:|---:|---:|---:|---|---|
| fast | 3.0 | 2.7 | 2.3 | 0.72 | euler_ancestral_cfg_pp | เร็วสุดสำหรับ iterate |
| balanced | 3.5 | 3.0 | 2.5 | 0.65 | euler_ancestral_cfg_pp | สมดุลคุณภาพ/ความนิ่ง |
| cinematic (current) | 4.0 | 3.5 | 3.0 | 0.58 | euler_ancestral_cfg_pp | ภาพเด่น แต่เสี่ยง continuity drop |
| template-like | 3.2 | 3.0 | 2.7 | 0.62 | euler | อิง template LTX2.3 reference |

ค่าที่แนะนำสำหรับ cinematic-lite (แนะนำใช้เมื่อจะพอร์ต):

- stage1Cfg: `3.6` (จาก 4.0)
- stage2Cfg: `3.2` (จาก 3.5)
- stage3Cfg: `2.8` (จาก 3.0)
- imageStrength: `0.62-0.64` (จาก 0.58)
- ลดความ aggressive ของ sigma schedule ในช่วงท้าย เพื่อลด motion drift

### 3.2 Prompt/Timeline Layer

สิ่งที่ต้องบังคับใน system prompt:

- Segment 1 ให้ establish scene ได้ แต่อนุญาต anticipatory motion ในฉาก dynamic
- Segment ถัดไปให้เน้น motion change ชัดเจน
- ใช้คำกริยาเชิง cinematic ที่บอก speed, direction, intensity
- น้ำหนัก segment ต้องสะท้อนความเป็น action จริง
- หลีกเลี่ยงการสั่ง motion หลายแบบขัดกันใน segment เดียว (เช่น push in + whip pan + hard tilt พร้อมกัน)
- หลีกเลี่ยงคำ/บริบทที่เสี่ยง moderation policy ของผู้ให้บริการ (เช่นการเมืองแบบเจาะจง)

ตัวอย่างคำที่ช่วย motion:

- accelerate, lunge, sweep, spin, rush, crash, track left, push in, whip pan

### 3.3 Frame Allocation Layer

- ถ้า opener ไม่มี motion verb ชัด ให้ลด weight opener เล็กน้อย
- realloc เฟรมไป segment ที่มี action สูงกว่า
- ตรวจเสมอว่า sum(segment lengths) = maxFrames

## 4) ลำดับการจูนที่แนะนำ (สำคัญ)

1. ปรับ sampler profile (`fast/balanced/template-like/cinematic-lite`) แล้วทดสอบก่อน
2. ปรับ prompt strategy เพื่อให้ segment language มี motion descriptors
3. ปรับ frame allocation เพื่อลด static tax ของ opener
4. ตรวจ frame parity ระหว่าง payload และ node mapping cloud
5. ตรวจ moderation risk ของ prompt ก่อนยิงงานจริง
6. ค่อยจูนเชิงละเอียด เช่น RIFE, CRF, ensemble

## 5) Experiment Matrix (ใช้ซ้ำได้กับโปรเจกต์อื่น)

ใช้ scene เดียวกัน, seed ใกล้เคียง, duration เท่ากัน แล้วรันตามนี้:

1. Baseline เดิม
2. Workflow-only (`balanced`)
3. Workflow-only (`template-like`)
4. Workflow-only (`cinematic-lite`)
5. Prompt/Timestep improvements only
6. Workflow + Prompt improvements
7. Workflow + Prompt + Frame reallocation

ให้เก็บ metric ต่อ run:

- Motion Intensity Score (1-10)
- Temporal Coherence Score (1-10)
- Prompt-to-Motion Alignment (1-10)
- Render Time (seconds)
- Failures/Artifacts

## 6) Checklist ก่อนปล่อยใช้งาน

- maxFrames ใน payload ตรงกับค่าที่ส่งเข้า workflow cloud
- Node IDs ที่ถูก override ยังตรงกับ workflow เวอร์ชันที่ใช้งาน
- profile fallback ชัดเจนเมื่อรับค่า profile ไม่ถูกต้อง
- default ของระบบชัดเจน: workflow=`ltx`, fps=`24`, duration=`8s`
- ตรวจ prompt ผ่าน safety policy เบื้องต้น (politics/abuse/illegal/terror/porn)
- unit tests ของ mapping, frame math, motion heuristics ผ่าน
- build/typecheck ผ่าน

## 7) Implementation Mapping (โปรเจกต์นี้)

ไฟล์อ้างอิงจากรอบจูนนี้:

- [src/core/runninghub.ts](../src/core/runninghub.ts)
- [src/core/ltxRunninghub.ts](../src/core/ltxRunninghub.ts)
- [src/core/runninghubWorkflow.ts](../src/core/runninghubWorkflow.ts)
- [src/core/builder.ts](../src/core/builder.ts)
- [src/core/analyzer.ts](../src/core/analyzer.ts)
- [src/prompts/systemPrompt.ts](../src/prompts/systemPrompt.ts)
- [src/utils/frames.ts](../src/utils/frames.ts)
- [src/server.ts](../src/server.ts)
- [public/index.html](../public/index.html)
- [run-runninghub-smoke.sh](../run-runninghub-smoke.sh)
- [tests/runninghub.test.ts](../tests/runninghub.test.ts)
- [tests/ltxRunninghub.test.ts](../tests/ltxRunninghub.test.ts)
- [tests/runninghubWorkflow.test.ts](../tests/runninghubWorkflow.test.ts)
- [tests/builder.test.ts](../tests/builder.test.ts)
- [tests/server.ltx-route.test.ts](../tests/server.ltx-route.test.ts)

## 8) วิธีประยุกต์กับโปรเจกต์อื่น

1. เริ่มจากคัดลอก profile table และ fallback policy (รวม `template-like` และ cinematic-lite)
2. ย้าย motion prompt rules ไป system prompt ของโปรเจกต์ปลายทาง
3. ย้าย frame reallocation heuristic ไป timeline builder
4. สร้าง mapping tests สำหรับ cloud workflow ของโปรเจกต์นั้น
5. ตั้งค่า default ให้ชัดเจนตั้งแต่ต้น: workflow=`ltx`, fps=`24`, duration=`8`
6. ใส่ pre-flight moderation keyword check เพื่อลดงานล้มตอนปลาย pipeline
7. รัน experiment matrix เดิมเพื่อหาค่า default ใหม่

## 9) Known Trade-offs

- motion สูงขึ้นมักแลกกับเวลา render และ VRAM
- CFG สูงเกินไปอาจเกิด visual artifacts หรือ motion loop
- segment มากเกินไปอาจทำให้ pacing กระชาก
- profile ที่ดีที่สุดขึ้นกับ scene type และ model behavior

## 10) Recommended Default

ถ้าต้องเลือกค่า default สำหรับ production ทั่วไป:

- ใช้ `balanced` เป็นค่าเริ่มต้น
- เปิดทางให้ผู้ใช้เลือก `template-like` เมื่อต้องการลุค cinematic ที่นิ่งกว่า
- ปรับ `cinematic` เป็น cinematic-lite ก่อนใช้งานจริง
- ใช้ `fast` สำหรับ iteration ระหว่างออกแบบ scene

## 11) Snapshot ล่าสุดที่ทดสอบจริง

- Default runtime ที่ใช้ทดสอบ: `workflow=ltx`, `fps=24`, `duration=8s`
- frame parity: ใช้แนวทาง `maxFrames + 1` ใน workflow mapping เพื่อให้ timeline กับ cloud ตรงกัน
- profile ที่ชนะเชิงใช้งานจริง: `balanced`
- profile ที่สูสีและควรเก็บไว้: `template-like`
- profile ที่ควรปรับก่อนใช้วงกว้าง: `cinematic` -> cinematic-lite
- ข้อควรระวังสำคัญ: prompt เชิงการเมืองอาจโดน audit fail (`error 805: Politics`) แม้ระบบส่วนอื่นทำงานถูกต้อง
