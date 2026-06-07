# 📰 สรุปข่าวหุ้นเทค NASDAQ (รายวัน)

ดึงข่าวหุ้นเทคสหรัฐ (NVIDIA, AMD, Intel, Apple, Microsoft ฯลฯ) จาก **Finnhub**
แล้วให้ **Claude AI** สรุปเป็นภาษาไทย และแสดงผลบนเว็บ **React** สวยงาม
ออกแบบให้รันวันละครั้ง (เช่น 18:00) แล้วเปิดดูตอนเย็น

```
f:\Stock\
├── fetch-news.mjs        # สคริปต์ดึงข่าว + สรุปด้วย AI
├── stocks.config.js      # รายชื่อหุ้นที่ติดตาม (แก้ได้)
├── run-daily.ps1         # สคริปต์รันประจำวัน (สำหรับ Task Scheduler)
├── .env                  # คีย์ API (สร้างเองจาก .env.example)
└── web/                  # เว็บ React (Vite)
    └── public/data/news.json   # ไฟล์ข้อมูลที่สคริปต์เขียนออกมา
```

---

## 1) ติดตั้งครั้งแรก

### ขอ API key (ฟรี)
1. **Finnhub** — สมัครที่ https://finnhub.io แล้วคัดลอก API key จากหน้า Dashboard
2. **Claude** — สมัครที่ https://console.anthropic.com แล้วสร้าง API key

### ตั้งค่าไฟล์ `.env`
คัดลอก `.env.example` เป็น `.env` แล้วใส่คีย์จริง:
```
FINNHUB_API_KEY=xxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
```

### ติดตั้ง dependencies
```powershell
# ในโฟลเดอร์ f:\Stock
npm install

# ติดตั้งของเว็บ
cd web
npm install
cd ..
```

---

## 2) ใช้งาน

### ดึงข่าว + สรุป (รันเมื่อต้องการอัปเดตข้อมูล)
```powershell
npm run fetch
```
สคริปต์จะดึงข่าวทุกตัว ส่งให้ Claude สรุปเป็นไทย แล้วเขียนผลลง
`web/public/data/news.json`

### เปิดเว็บดู
```powershell
cd web
npm run dev
```
เปิดเบราว์เซอร์ที่ http://localhost:5173

---

## 3) ตั้งให้รันอัตโนมัติทุกวัน 18:00 (Windows Task Scheduler)

1. เปิด **Task Scheduler** → **Create Task** (ไม่ใช่ Basic Task)
2. แท็บ **General**: ตั้งชื่อ เช่น `StockNewsDaily`, เลือก *Run whether user is logged on or not*
3. แท็บ **Triggers** → **New** → Daily → เวลา **18:00**
4. แท็บ **Actions** → **New**:
   - Program/script: `powershell.exe`
   - Add arguments:
     ```
     -ExecutionPolicy Bypass -File "f:\Stock\run-daily.ps1"
     ```
   - Start in: `f:\Stock`
5. กด OK

> เคล็ดลับ: ทดสอบได้โดยคลิกขวาที่ task แล้วเลือก **Run** เพื่อดูว่าทำงานถูกต้องไหม

หลังจาก task รัน ข้อมูลใน `news.json` จะอัปเดต — แค่รีเฟรชหน้าเว็บก็เห็นข่าวล่าสุด

---

## 4) ปรับแต่ง

- **เพิ่ม/ลบหุ้น** — แก้ไฟล์ [stocks.config.js](stocks.config.js)
- **เปลี่ยนรุ่นโมเดล AI** — เพิ่ม `CLAUDE_MODEL=claude-sonnet-4-6` ใน `.env` (ถูกกว่า opus)
- **จำนวนข่าวต่อหุ้น / ช่วงวันย้อนหลัง** — ค่า `MAX_HEADLINES_PER_STOCK` และ `LOOKBACK_DAYS` ใน `stocks.config.js`

---

## หมายเหตุ
- Finnhub free tier จำกัด ~60 ครั้ง/นาที สคริปต์จึงหน่วงเล็กน้อยระหว่างหุ้นแต่ละตัว
- เว็บนี้เป็นข้อมูลประกอบการศึกษา **ไม่ใช่คำแนะนำการลงทุน**
