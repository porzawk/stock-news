// ==========================================================================
//  ดึงข่าวหุ้นเทค NASDAQ จาก Finnhub -> สรุปเป็นภาษาไทยด้วย Claude -> เขียน JSON
//  ผลลัพธ์: web/public/data/news.json  (ให้เว็บ React อ่านไปแสดง)
//  รันด้วย:  npm run fetch
// ==========================================================================
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STOCKS, MAX_HEADLINES_PER_STOCK, LOOKBACK_DAYS } from "./stocks.config.js";
import { hasDatabase, ensureSchema, saveDailySnapshot, getHistory } from "./db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
// Groq เป็น AI สำรอง (OpenAI-compatible) ใช้เมื่อ Claude เรียกไม่ได้ เช่น credit หมด
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// จุดหมายของไฟล์ผลลัพธ์ (โฟลเดอร์ public ของเว็บ React)
const OUTPUT_PATH = join(__dirname, "web", "public", "data", "news.json");
// ไฟล์ประวัติย้อนหลัง (อ่านจาก Neon มาเขียนเป็น snapshot ให้เว็บ static อ่าน)
const HISTORY_PATH = join(__dirname, "web", "public", "data", "history.json");

// ---------- ตัวช่วยจัดรูปแบบวันที่ YYYY-MM-DD ----------
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------- 1) ดึงข่าวของหุ้นหนึ่งตัวจาก Finnhub ----------
async function fetchCompanyNews(symbol, from, to) {
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
    symbol
  )}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub ตอบกลับ ${res.status} สำหรับ ${symbol}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  // เรียงข่าวใหม่สุดก่อน, ตัดข่าวที่ไม่มีหัวข้อ, เอาแค่ N ข่าว
  return data
    .filter((n) => n.headline && n.url)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, MAX_HEADLINES_PER_STOCK)
    .map((n) => ({
      title: n.headline,
      summary: n.summary || "",
      url: n.url,
      source: n.source || "",
      datetime: new Date(n.datetime * 1000).toISOString(),
      image: n.image || "",
    }));
}

// ---------- 1.5) ดึงราคาปัจจุบัน + % เปลี่ยนแปลงของหุ้น ----------
async function fetchQuote(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
    symbol
  )}&token=${FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub quote ตอบกลับ ${res.status}`);
  const q = await res.json();
  // c=ราคาปัจจุบัน, d=เปลี่ยนแปลง, dp=% เปลี่ยนแปลง, pc=ราคาปิดก่อนหน้า
  if (q == null || typeof q.c !== "number" || q.c === 0) return null;
  return {
    current: q.c,
    change: q.d,
    percentChange: q.dp,
    prevClose: q.pc,
  };
}

// ---------- 2) สร้าง prompt + schema สำหรับให้ AI สรุป (ใช้ร่วมกันทุกเจ้า) ----------
function buildPrompts(stocksWithNews) {
  // สร้างข้อความรวมข่าวของทุกหุ้นให้ AI อ่าน
  const newsBlock = stocksWithNews
    .map((s) => {
      const lines = s.news
        .map(
          (n, i) =>
            `   ${i + 1}. [${n.source}] ${n.title}${
              n.summary ? ` — ${n.summary}` : ""
            }`
        )
        .join("\n");
      return `### ${s.symbol} (${s.name})\n${lines || "   (ไม่มีข่าวในช่วงนี้)"}`;
    })
    .join("\n\n");

  const systemPrompt =
    "คุณเป็นนักวิเคราะห์ข่าวหุ้นเทคโนโลยีตลาด NASDAQ ที่เชี่ยวชาญ " +
    "หน้าที่ของคุณคืออ่านพาดหัวข่าวภาษาอังกฤษแล้วสรุปเป็นภาษาไทยที่กระชับ เข้าใจง่าย " +
    "เป็นกลาง และเป็นประโยชน์ต่อนักลงทุน โดยไม่ใส่ความเห็นชี้นำให้ซื้อ/ขาย";

  const userPrompt = `นี่คือพาดหัวข่าวล่าสุดของหุ้นเทคแต่ละตัว:

${newsBlock}

กรุณาทำสิ่งต่อไปนี้ (ตอบเป็น JSON ตาม schema เท่านั้น):
1. marketOverview: สรุปภาพรวมตลาดหุ้นเทควันนี้ 2-4 ประโยค จากข่าวทั้งหมด
2. สำหรับหุ้นแต่ละตัว ให้สรุป:
   - summary: สรุปประเด็นข่าวสำคัญของหุ้นตัวนั้นเป็นภาษาไทย 1-3 ประโยค (ถ้าไม่มีข่าวให้บอกว่า "ไม่มีข่าวเด่นในช่วงนี้")
   - sentiment: ทิศทางข่าวโดยรวม เลือกจาก positive / neutral / negative
   - keyPoints: ประเด็นย่อย 1-3 ข้อ (bullet สั้นๆ ภาษาไทย)
ครอบคลุมหุ้นทุกตัวที่ให้มา และใช้ symbol ให้ตรงกัน`;

  const schema = {
    type: "object",
    properties: {
      marketOverview: { type: "string" },
      stocks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            summary: { type: "string" },
            sentiment: {
              type: "string",
              enum: ["positive", "neutral", "negative"],
            },
            keyPoints: { type: "array", items: { type: "string" } },
          },
          required: ["symbol", "summary", "sentiment", "keyPoints"],
          additionalProperties: false,
        },
      },
    },
    required: ["marketOverview", "stocks"],
    additionalProperties: false,
  };

  return { systemPrompt, userPrompt, schema };
}

// ---------- 2a) สรุปด้วย Claude (Anthropic) ----------
async function summarizeWithClaude({ systemPrompt, userPrompt, schema }) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema } },
  });
  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

// ---------- 2b) สรุปด้วย Groq (OpenAI-compatible) เป็นตัวสำรอง ----------
async function summarizeWithGroq({ systemPrompt, userPrompt, schema }) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 8000,
      // Groq รองรับ json_object — แนบ schema ไว้ใน prompt เพื่อให้รูปแบบตรงกัน
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            systemPrompt +
            "\n\nตอบกลับเป็น JSON object ที่ถูกต้องเท่านั้น ห้ามมีข้อความอื่นนอก JSON",
        },
        {
          role: "user",
          content:
            userPrompt +
            "\n\nตอบเป็น JSON object ตาม schema นี้เท่านั้น:\n" +
            JSON.stringify(schema),
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq ตอบกลับ ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

// ---------- 2) สรุปข่าว: ลอง Claude ก่อน ถ้าใช้ไม่ได้ (เช่น credit หมด) สลับไป Groq ----------
async function summarizeNews(stocksWithNews) {
  const prompts = buildPrompts(stocksWithNews);

  if (ANTHROPIC_API_KEY) {
    try {
      const ai = await summarizeWithClaude(prompts);
      return { ai, provider: `claude (${MODEL})` };
    } catch (err) {
      if (!GROQ_API_KEY) throw err; // ไม่มีตัวสำรอง — โยน error ต่อ
      const status = err.status ? `HTTP ${err.status} · ` : "";
      console.warn(
        `⚠ Claude ใช้ไม่ได้ (${status}${err.message}) — สลับไปใช้ Groq (${GROQ_MODEL})`
      );
    }
  }

  if (!GROQ_API_KEY) {
    throw new Error(
      "ไม่พบทั้ง ANTHROPIC_API_KEY และ GROQ_API_KEY — ตั้งค่าอย่างน้อยหนึ่งตัวใน .env"
    );
  }
  const ai = await summarizeWithGroq(prompts);
  return { ai, provider: `groq (${GROQ_MODEL})` };
}

// ---------- main ----------
async function main() {
  if (!FINNHUB_API_KEY) {
    console.error("❌ ไม่พบ FINNHUB_API_KEY ใน .env (สมัครฟรีที่ https://finnhub.io)");
    process.exit(1);
  }
  if (!ANTHROPIC_API_KEY && !GROQ_API_KEY) {
    console.error(
      "❌ ไม่พบ ANTHROPIC_API_KEY หรือ GROQ_API_KEY ใน .env (ต้องมีอย่างน้อยหนึ่งตัว)"
    );
    process.exit(1);
  }

  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - LOOKBACK_DAYS);
  const fromStr = fmtDate(from);
  const toStr = fmtDate(today);

  console.log(`📰 ดึงข่าวหุ้น ${STOCKS.length} ตัว ช่วง ${fromStr} ถึง ${toStr}...`);

  // ดึงข่าวทีละตัว (กัน rate limit ของ Finnhub free tier)
  const stocksWithNews = [];
  for (const stock of STOCKS) {
    let news = [];
    let quote = null;
    try {
      news = await fetchCompanyNews(stock.symbol, fromStr, toStr);
    } catch (err) {
      console.warn(`   ⚠ ${stock.symbol} (ข่าว): ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 600));
    try {
      quote = await fetchQuote(stock.symbol);
    } catch (err) {
      console.warn(`   ⚠ ${stock.symbol} (ราคา): ${err.message}`);
    }
    const pct =
      quote && typeof quote.percentChange === "number"
        ? `${quote.percentChange > 0 ? "+" : ""}${quote.percentChange.toFixed(2)}%`
        : "n/a";
    console.log(`   ✓ ${stock.symbol.padEnd(6)} ${news.length} ข่าว · ${pct}`);
    stocksWithNews.push({ ...stock, news, quote });
    // หน่วงเล็กน้อยกัน rate limit (60 calls/min ฟรี)
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log("🤖 ส่งให้ AI สรุปเป็นภาษาไทย...");
  const { ai, provider } = await summarizeNews(stocksWithNews);
  console.log(`   ✓ สรุปด้วย ${provider}`);

  // รวมข้อมูลสรุปจาก AI เข้ากับ headline จริง (เก็บลิงก์ไว้ครบ)
  const aiBySymbol = new Map((ai.stocks || []).map((s) => [s.symbol, s]));
  const stocks = stocksWithNews.map((s) => {
    const a = aiBySymbol.get(s.symbol) || {};
    return {
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      sentiment: a.sentiment || "neutral",
      summary: a.summary || "ไม่มีข่าวเด่นในช่วงนี้",
      keyPoints: a.keyPoints || [],
      quote: s.quote,
      headlines: s.news,
      newsCount: s.news.length,
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    dateRange: { from: fromStr, to: toStr },
    model: provider,
    marketOverview: ai.marketOverview || "",
    stocks,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`✅ เขียนผลลัพธ์เรียบร้อย: ${OUTPUT_PATH}`);

  // ---------- บันทึกประวัติลง Neon + เขียน history.json ให้เว็บ ----------
  if (!hasDatabase()) {
    console.warn("⚠ ข้าม Neon: ไม่พบ DATABASE_URL ใน .env (ไม่เก็บประวัติ/ไม่มีหน้าสรุปย้อนหลัง)");
    return;
  }

  try {
    await ensureSchema();

    // 1 แถวต่อหุ้นต่อวัน — ใช้วันที่ "to" (วันนี้) เป็น key ของวัน
    const snapshotRows = stocks.map((s) => ({
      date: toStr,
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      sentiment: s.sentiment,
      quote: s.quote,
      newsCount: s.newsCount,
      summary: s.summary,
    }));

    const saved = await saveDailySnapshot(snapshotRows);
    console.log(`🗄  บันทึกลง Neon ${saved} แถว (วันที่ ${toStr})`);

    // ดึงประวัติย้อนหลังมาเขียนเป็น snapshot ให้เว็บ static อ่าน
    const history = await getHistory(90);
    const historyOutput = {
      generatedAt: new Date().toISOString(),
      days: 90,
      rows: history,
    };
    await writeFile(HISTORY_PATH, JSON.stringify(historyOutput, null, 2), "utf-8");
    console.log(`✅ เขียนประวัติ ${history.length} แถว: ${HISTORY_PATH}`);
  } catch (err) {
    console.error("❌ บันทึก/อ่านประวัติจาก Neon ล้มเหลว:", err.message);
    // ไม่ throw — ให้ข่าวรายวันยังทำงานได้แม้ DB มีปัญหา
  }
}

main().catch((err) => {
  console.error("❌ เกิดข้อผิดพลาด:", err);
  process.exit(1);
});
