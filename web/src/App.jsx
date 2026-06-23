import { useEffect, useMemo, useState } from "react";
import StockCard from "./StockCard.jsx";
import Dashboard from "./Dashboard.jsx";
import History from "./History.jsx";

const SENTIMENT_FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "positive", label: "บวก" },
  { key: "neutral", label: "กลาง" },
  { key: "negative", label: "ลบ" },
];

function formatThaiDateTime(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("th-TH", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("dashboard"); // "dashboard" | "news"

  useEffect(() => {
    // ใช้ path แบบ relative (กัน subpath ของ GitHub Pages) + กัน cache เก่า
    fetch(`${import.meta.env.BASE_URL}data/news.json?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error("ยังไม่มีข้อมูลข่าว (ลองรัน npm run fetch ก่อน)");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const counts = useMemo(() => {
    const c = { all: 0, positive: 0, neutral: 0, negative: 0 };
    if (data?.stocks) {
      for (const s of data.stocks) {
        c.all++;
        c[s.sentiment] = (c[s.sentiment] || 0) + 1;
      }
    }
    return c;
  }, [data]);

  const filteredStocks = useMemo(() => {
    if (!data?.stocks) return [];
    const q = query.trim().toLowerCase();
    return data.stocks.filter((s) => {
      const matchSentiment = filter === "all" || s.sentiment === filter;
      const matchQuery =
        !q ||
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q);
      return matchSentiment && matchQuery;
    });
  }, [data, filter, query]);

  if (error) {
    return (
      <div className="app">
        <div className="empty-state">
          <h2>📭 ยังไม่มีข้อมูล</h2>
          <p>{error}</p>
          <code>npm run fetch</code>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app">
        <div className="empty-state">
          <div className="spinner" />
          <p>กำลังโหลดข่าว...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="brand">
            <span className="brand-mark">▌</span>
            <h1>
              สรุปข่าวหุ้นเทค <span className="accent">NASDAQ</span>
            </h1>
          </div>
          <div className="meta">
            <span className="meta-label">อัปเดตล่าสุด</span>
            <span className="meta-value">{formatThaiDateTime(data.generatedAt)}</span>
          </div>
        </div>
        <p className="subtitle">
          ข่าวช่วง {data.dateRange?.from} ถึง {data.dateRange?.to} · สรุปโดย AI ({data.model})
        </p>
        <nav className="tabs">
          <button
            className={`tab ${view === "dashboard" ? "active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            📊 กราฟสรุป
          </button>
          <button
            className={`tab ${view === "news" ? "active" : ""}`}
            onClick={() => setView("news")}
          >
            📰 ข่าวรายตัว
          </button>
          <button
            className={`tab ${view === "history" ? "active" : ""}`}
            onClick={() => setView("history")}
          >
            📈 สรุปย้อนหลัง
          </button>
        </nav>
      </header>

      {view === "dashboard" && <Dashboard data={data} />}

      {view === "history" && <History />}

      {view === "news" && (
      <>
      <div className="toolbar">
        <div className="filters">
          {SENTIMENT_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-btn ${filter === f.key ? "active" : ""} sent-${f.key}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="count">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          className="search"
          type="text"
          placeholder="ค้นหาหุ้น เช่น NVDA หรือ Nvidia"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <main className="grid">
        {filteredStocks.map((stock) => (
          <StockCard key={stock.symbol} stock={stock} />
        ))}
        {filteredStocks.length === 0 && (
          <p className="no-result">ไม่พบหุ้นที่ตรงกับเงื่อนไข</p>
        )}
      </main>
      </>
      )}

      <footer className="footer">
        <p>
          ข้อมูลข่าวจาก Finnhub · สรุปด้วย Claude · เว็บนี้เป็นข้อมูลประกอบการศึกษา
          ไม่ใช่คำแนะนำการลงทุน
        </p>
      </footer>
    </div>
  );
}
