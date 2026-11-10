# Worklist Management

ระบบติดตามและตรวจสอบงานที่มอบหมาย (ธีมสีแดง-ขาว ออกแบบให้ใช้บนมือถือเป็นหลัก)

**เทคโนโลยี:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Firebase Authentication · MongoDB (+ GridFS สำหรับเก็บรูปภาพ)

ใช้บริการภายนอกเพียง **2 อย่าง** คือ ฐานข้อมูล MongoDB (เช่น MongoDB Atlas แพ็กเกจฟรี) และ Firebase project (ใช้เฉพาะ Authentication) รูปภาพเก็บอยู่ใน MongoDB จึงไม่ต้องดูแลที่เก็บไฟล์แยก

---

## ความสามารถของระบบ

| บทบาท | แท็บ | ทำอะไรได้บ้าง |
|---|---|---|
| **Employer (นายจ้าง)** | รายการงาน · เพิ่มรายการงาน · จัดการบุคคล · บัญชี | ดูงานทั้งหมด (รวมงานที่เก็บถาวร) ตรวจงานที่ส่งมา (รูปภาพ + หมายเหตุ) อนุมัติหรือส่งกลับแก้ไข ลบงานแบบไม่ลบจริง (Archive) และกู้คืน (Restore) แก้ไขงาน เพิ่ม/แก้ไข/ปิดการใช้งานผู้ใช้ กำหนดสิทธิ์ และรีเซ็ตรหัสผ่าน |
| **Employee (ลูกจ้าง)** | รายการงาน · บัญชี | ดูงานที่ได้รับมอบหมายและงานที่เปิดให้ทุกคน กดรับงาน เริ่มงาน ส่งงานพร้อมรูปหลายรูปและหมายเหตุ ดูผลการตรวจและประวัติการส่งงานทั้งหมด |

- **กฎการรับงาน:** งานประเภท "ทุกคน" พนักงานทุกคนมองเห็นได้ แต่รับได้เพียงคนเดียว การรับงานเป็นการอัปเดต MongoDB ครั้งเดียวแบบ atomic ดังนั้นถ้าสองคนกด "รับงาน" พร้อมกัน จะมีผู้ได้งานเพียงคนเดียว คนอื่นยังเห็นงานนั้นในสถานะ "มีผู้รับงานแล้ว"
- **ลบ = เก็บถาวร (Archive):** ไม่มีข้อมูลใดถูกลบจริง สถานะจะเปลี่ยนเป็น `Archived` และระบบจำสถานะก่อนหน้าไว้ เมื่อกด **Restore** งานจะกลับไปสถานะเดิมทุกประการ
- **ลำดับสถานะ:** `Open → Claimed → In Progress → Pending Review → Approved | Rejected → (ส่งใหม่) Pending Review` และเปลี่ยนเป็น `Archived` ได้จากทุกสถานะ
- **ประวัติการส่งงาน:** ทุกครั้งที่ส่งงานจะถูกเก็บไว้ พร้อมรูปภาพ หมายเหตุ ผลการตรวจ และความเห็นของผู้ตรวจ
- **รูปภาพ:** แนบได้หลายรูปต่อการส่งงานหนึ่งครั้ง (สูงสุด 10 รูป) ระบบย่อขนาดในเบราว์เซอร์ (JPEG ประมาณ 1600px) ก่อนอัปโหลด และแสดงให้เฉพาะผู้ที่ล็อกอินแล้วเท่านั้น
- **บัญชีผู้ใช้:** ทุกคนเปลี่ยนรหัสผ่านและแก้ไขข้อมูลส่วนตัวพื้นฐานได้เอง เมื่อเปลี่ยนรหัสผ่าน อุปกรณ์อื่นจะถูกออกจากระบบ และเมื่อปิดการใช้งานผู้ใช้ ผู้ใช้นั้นจะถูกออกจากระบบทันที

## โครงสร้างโปรเจกต์

```
src/
  app/
    login/                    หน้าเข้าสู่ระบบ
    (app)/                    ส่วนที่ต้องล็อกอิน (layout ฝั่งเซิร์ฟเวอร์ตรวจ session)
      tasks/                  แท็บ: รายการงาน (+ การ์ดสรุปภาพรวม)
      tasks/[id]/             รายละเอียดงาน: รับงาน / ส่งงาน / ตรวจงาน / เก็บถาวร / ประวัติ
      account/                ข้อมูลส่วนตัว + เปลี่ยนรหัสผ่าน
      (employer)/             เฉพาะนายจ้าง (layout ฝั่งเซิร์ฟเวอร์ตรวจสิทธิ์)
        create/               แท็บ: เพิ่มรายการงาน + ตารางงานทั้งหมด
        users/                แท็บ: จัดการบุคคล
    api/                      REST API (ดูด้านล่าง)
  server/                     โค้ดที่รันเฉพาะฝั่งเซิร์ฟเวอร์
    db.ts                     การเชื่อมต่อ MongoDB, ชนิดข้อมูลของเอกสาร, index, GridFS
    auth.ts / session.ts      แปลง Firebase session cookie → ผู้ใช้ปัจจุบัน
    tasks.ts                  กฎทางธุรกิจของงาน (รับงาน ส่งงาน ตรวจงาน เก็บถาวร ฯลฯ)
    users.ts                  การจัดการผู้ใช้ (ข้อมูลใน Firebase กับ MongoDB ตรงกันเสมอ)
  components/                 คอมโพเนนต์ UI
  lib/                        ตัวช่วยที่ใช้ร่วมกัน (ค่าคงที่ การจัดรูปแบบ fetch ฝั่ง client)
  types/                      ชนิดข้อมูล DTO ที่ใช้ร่วมกัน
scripts/seed-admin.ts         สร้างบัญชีนายจ้าง (Employer) คนแรก
```

### API

| Method | Path | ผู้ใช้งาน |
|---|---|---|
| POST / DELETE | `/api/auth/session` | เข้าสู่ระบบ (ID token → cookie) / ออกจากระบบ |
| GET | `/api/me` | ทุกคน |
| GET / POST | `/api/tasks` | ดูรายการ (กรองตามบทบาท) / สร้างงาน (นายจ้าง) |
| GET / PATCH | `/api/tasks/:id` | รายละเอียด + ประวัติ / แก้ไข (นายจ้าง) |
| POST | `/api/tasks/:id/claim` · `start` · `submit` | ลูกจ้าง |
| POST | `/api/tasks/:id/review` · `archive` · `restore` | นายจ้าง |
| GET / POST | `/api/users` · PATCH `/api/users/:id` | นายจ้าง |
| PATCH | `/api/account` · GET/POST `/api/account/password` | ทุกคน |
| POST | `/api/uploads` · GET `/api/images/:id` | ทุกคนที่ล็อกอินแล้ว |

### ฐานข้อมูล (collection ใน MongoDB)

- `users` — `_id, firebase_uid, username, name, phone, email, role, status, created_at, updated_at`
  *ไม่เก็บรหัสผ่านไว้ที่นี่ Firebase Authentication เป็นผู้ดูแลรหัสผ่าน (เข้ารหัสแบบ hash และจำกัดจำนวนครั้งการล็อกอิน)*
- `tasks` — `_id, code (T-00001), title, description, location, assigned_type (all|individual), assigned_user, status, previous_status, due_date, is_archived, created_by, created_at, updated_at, claimed_at`
- `task_submissions` — `_id, task_id, user_id, note, image_urls[], submitted_at, review_status, review_note, reviewed_by, reviewed_at`
- `password_history` — `_id, user_id, changed_at, changed_by`
- `images.files` / `images.chunks` — ที่เก็บรูปภาพแบบ GridFS
- `counters` — ตัวนับลำดับสำหรับรหัสงาน

ระบบสร้าง index ให้อัตโนมัติเมื่อเชื่อมต่อฐานข้อมูลครั้งแรก

---

## การติดตั้ง (ใช้งานจริงกับบริการจริง)

1. **MongoDB:** สร้าง cluster บน [MongoDB Atlas](https://www.mongodb.com/atlas) → คัดลอก connection string และอนุญาตการเข้าถึงเครือข่ายจากเซิร์ฟเวอร์ของคุณ (ถ้าใช้ Vercel ให้ตั้งเป็น `0.0.0.0/0`)
2. **Firebase:** สร้าง project → **Authentication → Sign-in method → เปิดใช้ Email/Password**
   - Project settings → *Your apps* → เพิ่ม Web app → คัดลอก `apiKey`, `authDomain`, `projectId`
   - Project settings → *Service accounts* → **Generate new private key** → คัดลอก `client_email` และ `private_key`
3. รัน `cp .env.example .env.local` แล้วกรอกค่าต่าง ๆ
4. ติดตั้งและสร้างผู้ดูแลระบบคนแรก:
   ```bash
   npm install
   npm run seed:admin      # ใช้ค่า SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD
   npm run dev
   ```
5. เปิด http://localhost:3000 เข้าสู่ระบบ แล้วเพิ่มผู้ใช้ในแท็บ **จัดการบุคคล**

> ผู้ใช้เข้าสู่ระบบด้วย **ชื่อผู้ใช้ (username)** เบื้องหลังระบบจะแปลงเป็นอีเมลของ Firebase ในรูปแบบ `<username>@worklist.local` (เปลี่ยนโดเมนได้ที่ `NEXT_PUBLIC_USERNAME_EMAIL_DOMAIN`) จึงไม่จำเป็นต้องมีอีเมลจริง

## พัฒนาในเครื่องโดยไม่ต้องมี Firebase project

ใช้ Firebase Auth emulator (ต้องติดตั้ง Java) ร่วมกับ MongoDB ในเครื่อง:

```bash
npx firebase-tools emulators:start --only auth --project demo-worklist
```

ใน `.env.local` ให้ตั้งค่า `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-worklist` และเว้นค่าของ service account ว่างไว้ ผู้ใช้ใน emulator จะหายไปเมื่อปิด emulator ให้รัน `npm run seed:admin` ใหม่

## การ Deploy (แนะนำ Vercel)

1. Push โค้ดขึ้น GitHub → กด **Import** ใน Vercel
2. เพิ่มตัวแปรทุกตัวจาก `.env.example` ที่ *Project → Settings → Environment Variables* (วาง `FIREBASE_PRIVATE_KEY` โดยคงเครื่องหมาย `\n` ไว้ และ **ห้าม** ตั้งค่าตัวแปรของ emulator)
3. กด Deploy จากนั้นรัน `npm run seed:admin` จากเครื่องของคุณหนึ่งครั้งโดยใช้ค่า env ของ production เพื่อสร้างผู้ดูแลระบบคนแรก

ใช้กับเซิร์ฟเวอร์ใดก็ได้ที่มี Node 20 ขึ้นไป: `npm run build && npm start`

## หมายเหตุและแนวทางต่อยอด

- หน้ารายการโหลดงานได้สูงสุด 1,000 รายการ แล้วกรองในเบราว์เซอร์ ซึ่งเพียงพอสำหรับทีมขนาดเล็กถึงกลาง หากงานมากกว่านั้นควรเพิ่มการแบ่งหน้าฝั่งเซิร์ฟเวอร์
- รูปที่อัปโหลดแล้วแต่ไม่ได้ส่งงาน จะค้างอยู่ใน GridFS ควรเพิ่มงานล้างข้อมูลเป็นระยะ เพื่อลบไฟล์ที่ไม่มีการส่งงานใดอ้างถึง
- ย้ายรูปภาพไป Firebase Storage หรือ S3 ภายหลังได้ โดยแก้เพียง `api/uploads` และ `api/images` (ข้อมูลการส่งงานเก็บเป็น URL อยู่แล้ว)
- แนวทางพัฒนาต่อ: แจ้งเตือน (LINE / อีเมล) เมื่อมีการส่งงานและตรวจงาน, ปล่อยงานที่รับแล้วกลับเป็น Open, ส่งออกเป็น CSV, ความคิดเห็นในงาน
