# Motion Tuning Quickstart (LTX2.3)

เอกสารสั้นสำหรับย้ายแนวทางจูนจากโปรเจกต์ Scene-to-Timeline ไปใช้กับโปรเจกต์อื่นแบบเร็ว

## 1) ค่าที่แนะนำให้ตั้งเป็นค่าเริ่มต้น

- workflow: `ltx`
- fps: `24`
- duration: `8s`
- frame parity: ใช้แนวทาง `maxFrames + 1` ตอน map เข้า cloud workflow

เหตุผล: เป็นค่าที่ผ่านการทดสอบแล้วว่าเสถียรและได้ continuity ดี

## 2) Profile Strategy (จากผลทดสอบล่าสุด)

- `balanced`:
  - ใช้เป็น production default
  - ได้ temporal coherence ดีสุด
- `template-like`:
  - คุณภาพสูสีกับ balanced
  - โทนภาพนุ่มขึ้นในบางซีน
- `cinematic` (เดิม):
  - สวยแต่เสี่ยงต่อเนื่องหลุด (over-stylized)
  - ควรปรับเป็น cinematic-lite ก่อนใช้งานจริง
- `fast`:
  - เหมาะกับ iteration ระหว่างทดลอง prompt

## 3) ค่าจูน LTX2.3 ที่ใช้งานจริง

### fast
- stage1Cfg: `3.0`
- stage2Cfg: `2.7`
- stage3Cfg: `2.3`
- imageStrength: `0.72`
- samplerName: `euler_ancestral_cfg_pp`

### balanced
- stage1Cfg: `3.5`
- stage2Cfg: `3.0`
- stage3Cfg: `2.5`
- imageStrength: `0.65`
- samplerName: `euler_ancestral_cfg_pp`

### template-like
- stage1Cfg: `3.2`
- stage2Cfg: `3.0`
- stage3Cfg: `2.7`
- imageStrength: `0.62`
- samplerName: `euler`

## 4) Cinematic-lite (ค่าที่แนะนำ)

ปรับจาก cinematic เดิมเพื่อแก้ video ไม่ต่อเนื่อง:

- stage1Cfg: `3.6` (เดิม 4.0)
- stage2Cfg: `3.2` (เดิม 3.5)
- stage3Cfg: `2.8` (เดิม 3.0)
- imageStrength: `0.62-0.64` (เดิม 0.58)
- ลดความ aggressive ของ sigma schedule ช่วงท้าย

## 5) Prompt Rules ที่ต้องพกไปทุกโปรเจกต์

- Segment opener ต้อง establish scene แต่ไม่ static เกินไป
- Segment ถัดไปต้องมี motion change ชัดเจน
- ใช้ motion verbs ที่บอก direction/speed ชัดเจน
- อย่าใส่กล้องหลายคำสั่งที่ขัดกันใน segment เดียว (เช่น push-in + whip-pan + hard-tilt)

## 6) Frame Allocation Rules

- ถ้า opener ไม่มี motion verb ชัด ให้ลด weight opener เล็กน้อย
- โยกเฟรมไป segment ที่ action หนักกว่า
- ตรวจว่า sum(segment lengths) เท่ากับ maxFrames เสมอ

## 7) Moderation Safety (สำคัญ)

RunningHub อาจ fail ด้วย audit error (เช่น `805: Politics`) แม้ pipeline ถูกทั้งหมด

ก่อนส่งงานจริง:
- ทำ pre-flight keyword check
- หลีกเลี่ยง prompt ที่เป็นการเมืองแบบเจาะจง
- เตรียม fallback prompt ที่ semantic ใกล้เคียงแต่ปลอด policy

## 8) Migration Checklist (สั้นที่สุด)

1. คัดลอก profile presets + fallback policy
2. ย้าย prompt motion rules เข้า system prompt โปรเจกต์ปลายทาง
3. ย้าย frame reallocation heuristic เข้า timeline builder
4. ตรวจ node mapping และ frame parity ให้ตรง workflow cloud
5. ตั้ง default เป็น `ltx + 24fps + 8s`
6. เพิ่ม moderation pre-check
7. รัน A/B อย่างน้อย 3 โปรไฟล์: `balanced`, `template-like`, `cinematic-lite`

## 9) จุดอ้างอิงในโปรเจกต์นี้

- `src/core/ltxRunninghub.ts`
- `src/core/runninghubWorkflow.ts`
- `src/core/builder.ts`
- `src/prompts/systemPrompt.ts`
- `tests/ltxRunninghub.test.ts`
- `tests/runninghubWorkflow.test.ts`
- `tests/builder.test.ts`

## 10) Source-to-Target Mapping Table

ใช้ตารางนี้ตอนพอร์ตไปโปรเจกต์ใหม่ โดยแมปไฟล์ปลายทางให้เทียบบทบาทเดียวกัน:

| Source (โปรเจกต์นี้) | Target (โปรเจกต์ปลายทาง) | ต้องย้ายอะไร |
|---|---|---|
| `src/core/ltxRunninghub.ts` | adapter/workflow ของ LTX ในโปรเจกต์ปลายทาง | profile presets, samplerName, imageStrength, node override mapping |
| `src/core/runninghubWorkflow.ts` | orchestration layer หรือ service ที่เลือก workflow | default workflow=`ltx`, default fps=`24`, fallback policy |
| `src/core/builder.ts` | timeline builder หรือ scene planner | opener static penalty, action-aware frame reallocation |
| `src/prompts/systemPrompt.ts` | prompt template ของ analyzer/model | motion verb rules, continuity guardrails, moderation-safe wording |
| `tests/ltxRunninghub.test.ts` | unit tests ของ workflow adapter | profile mapping tests, frame parity tests, node mapping tests |
| `tests/runninghubWorkflow.test.ts` | unit tests ของ orchestration layer | default selection tests, fps injection tests, plan routing tests |
| `tests/builder.test.ts` | unit tests ของ timeline builder | frame allocation behavior และ action boost tests |

## 11) Step-by-Step Migration Runbook

1. สร้าง profile presets ใน adapter ปลายทางก่อน
2. ตั้ง fallback policy ให้รับ profile แปลกแล้วถอยไป `balanced`
3. บังคับ default runtime: `workflow=ltx`, `fps=24`, `duration=8s`
4. ย้าย logic `maxFrames + 1` ให้ตรง cloud workflow
5. ย้าย frame reallocation heuristic จาก builder
6. ย้าย prompt rules ที่บังคับ motion และ continuity
7. เพิ่ม moderation pre-check ก่อนยิง RunningHub
8. เขียน/ย้าย unit tests ตาม mapping table
9. รัน A/B รอบแรกด้วย `balanced`, `template-like`, `cinematic-lite`
10. เลือก production default จาก metric: temporal coherence เป็นอันดับแรก

## 12) Acceptance Criteria สำหรับโปรเจกต์ปลายทาง

- timeline กับ cloud workflow ไม่มี frame mismatch
- อย่างน้อย 3 โปรไฟล์รันผ่านโดยไม่ fail จาก config
- default (`balanced`) ให้ continuity ดีกว่า `cinematic` เดิม
- pipeline ผ่าน unit tests หลักของ adapter/orchestration/builder
- มีเอกสาร fallback และ moderation policy สำหรับทีมใช้งาน
