// ==========================================================================
//  เลเยอร์ฐานข้อมูล Neon (Postgres) สำหรับเก็บประวัติข่าว + ราคาหุ้นรายวัน
//  ใช้ไดรเวอร์ @neondatabase/serverless (เบา ใช้ผ่าน HTTP ได้เลย ไม่ต้องเปิด pool)
//  - ensureSchema()      : สร้างตารางถ้ายังไม่มี
//  - saveDailySnapshot() : บันทึก/อัปเดตข้อมูลของวันนี้ (1 แถวต่อหุ้นต่อวัน)
//  - getHistory()        : ดึงประวัติย้อนหลังมาให้เว็บใช้
// ==========================================================================
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

// แปลงทิศทางข่าวเป็นคะแนนตัวเลข เพื่อเอาไปหา correlation กับราคาได้
export function sentimentScore(sentiment) {
  if (sentiment === "positive") return 1;
  if (sentiment === "negative") return -1;
  return 0; // neutral หรือไม่ทราบ
}

// คืนค่า client ของ Neon (โยน error ถ้าไม่ได้ตั้ง DATABASE_URL)
function getSql() {
  if (!DATABASE_URL) {
    throw new Error(
      "ไม่พบ DATABASE_URL ใน .env — สร้าง Neon project แล้วคัดลอก connection string มาใส่"
    );
  }
  return neon(DATABASE_URL);
}

// มี DATABASE_URL ให้ใช้ไหม (ไว้ให้สคริปต์เช็คก่อนเรียก เพื่อข้ามได้แบบไม่พัง)
export function hasDatabase() {
  return Boolean(DATABASE_URL);
}

// ---------- สร้างตารางถ้ายังไม่มี ----------
export async function ensureSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS daily_snapshot (
      id              SERIAL PRIMARY KEY,
      date            DATE NOT NULL,
      symbol          TEXT NOT NULL,
      name            TEXT,
      sector          TEXT,
      sentiment       TEXT NOT NULL,            -- positive | neutral | negative
      sentiment_score INTEGER NOT NULL,         -- 1 | 0 | -1
      price_current   DOUBLE PRECISION,         -- ราคาปัจจุบัน
      prev_close      DOUBLE PRECISION,         -- ราคาปิดของวันก่อน
      price_change    DOUBLE PRECISION,         -- เปลี่ยนแปลงเป็นดอลลาร์
      percent_change  DOUBLE PRECISION,         -- % เปลี่ยนแปลงเทียบราคาวันก่อน
      news_count      INTEGER DEFAULT 0,
      summary         TEXT,
      created_at      TIMESTAMPTZ DEFAULT now(),
      UNIQUE (date, symbol)
    )
  `;
}

// ---------- บันทึก/อัปเดตข้อมูลของวันนี้ ----------
// rows: อาเรย์ของ { date, symbol, name, sector, sentiment, quote, newsCount, summary }
export async function saveDailySnapshot(rows) {
  const sql = getSql();
  let saved = 0;
  for (const r of rows) {
    const q = r.quote || {};
    await sql`
      INSERT INTO daily_snapshot
        (date, symbol, name, sector, sentiment, sentiment_score,
         price_current, prev_close, price_change, percent_change,
         news_count, summary)
      VALUES
        (${r.date}, ${r.symbol}, ${r.name ?? null}, ${r.sector ?? null},
         ${r.sentiment}, ${sentimentScore(r.sentiment)},
         ${q.current ?? null}, ${q.prevClose ?? null},
         ${q.change ?? null}, ${q.percentChange ?? null},
         ${r.newsCount ?? 0}, ${r.summary ?? null})
      ON CONFLICT (date, symbol) DO UPDATE SET
        name            = EXCLUDED.name,
        sector          = EXCLUDED.sector,
        sentiment       = EXCLUDED.sentiment,
        sentiment_score = EXCLUDED.sentiment_score,
        price_current   = EXCLUDED.price_current,
        prev_close      = EXCLUDED.prev_close,
        price_change    = EXCLUDED.price_change,
        percent_change  = EXCLUDED.percent_change,
        news_count      = EXCLUDED.news_count,
        summary         = EXCLUDED.summary
    `;
    saved++;
  }
  return saved;
}

// ---------- ดึงประวัติย้อนหลัง (ค่าเริ่มต้น 90 วันล่าสุด) ----------
export async function getHistory(days = 90) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      to_char(date, 'YYYY-MM-DD') AS date,
      symbol, name, sector, sentiment, sentiment_score,
      price_current, prev_close, price_change, percent_change, news_count
    FROM daily_snapshot
    WHERE date >= CURRENT_DATE - ${days}::int
    ORDER BY date ASC, symbol ASC
  `;
  // แปลงชื่อคอลัมน์ snake_case -> camelCase ให้เว็บใช้สะดวก
  return rows.map((r) => ({
    date: r.date,
    symbol: r.symbol,
    name: r.name,
    sector: r.sector,
    sentiment: r.sentiment,
    sentimentScore: r.sentiment_score,
    priceCurrent: r.price_current,
    prevClose: r.prev_close,
    priceChange: r.price_change,
    percentChange: r.percent_change,
    newsCount: r.news_count,
  }));
}
