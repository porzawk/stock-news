import { useState } from "react";

const SENTIMENT_META = {
  positive: { label: "ข่าวเชิงบวก", icon: "▲" },
  neutral: { label: "เป็นกลาง", icon: "■" },
  negative: { label: "ข่าวเชิงลบ", icon: "▼" },
};

const REC_META = {
  buy: { label: "ซื้อเลย", icon: "✓" },
  wait: { label: "รอก่อน", icon: "⏸" },
  your_call: { label: "แล้วแต่คุณ", icon: "?" },
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function StockCard({ stock }) {
  const [open, setOpen] = useState(false);
  const sent = SENTIMENT_META[stock.sentiment] || SENTIMENT_META.neutral;
  const rec = REC_META[stock.recommendation];

  return (
    <article className={`card sent-${stock.sentiment}`}>
      <div className="card-head">
        <div>
          <span className="symbol">{stock.symbol}</span>
          <span className="name">{stock.name}</span>
        </div>
        <span className={`badge sent-${stock.sentiment}`}>
          {sent.icon} {sent.label}
        </span>
      </div>

      <div className="card-sub">
        {stock.sector && <span className="sector">{stock.sector}</span>}
        {stock.quote && typeof stock.quote.percentChange === "number" && (
          <span
            className={`price ${stock.quote.percentChange >= 0 ? "up" : "down"}`}
          >
            ${stock.quote.current?.toFixed(2)}{" "}
            <b>
              {stock.quote.percentChange >= 0 ? "+" : ""}
              {stock.quote.percentChange.toFixed(2)}%
            </b>
          </span>
        )}
      </div>

      {rec && (
        <div className={`rec rec-${stock.recommendation}`}>
          <span className="rec-badge">
            {rec.icon} {rec.label}
          </span>
          {stock.recommendationReason && (
            <span className="rec-reason">{stock.recommendationReason}</span>
          )}
          {(typeof stock.buyPrice === "number" ||
            typeof stock.sellPrice === "number") && (
            <span className="rec-prices">
              {typeof stock.buyPrice === "number" && (
                <span className="rec-price buy">
                  เข้า ~${stock.buyPrice.toFixed(2)}
                </span>
              )}
              {typeof stock.sellPrice === "number" && (
                <span className="rec-price sell">
                  ออก ~${stock.sellPrice.toFixed(2)}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <p className="summary">{stock.summary}</p>

      {stock.keyPoints?.length > 0 && (
        <ul className="key-points">
          {stock.keyPoints.map((kp, i) => (
            <li key={i}>{kp}</li>
          ))}
        </ul>
      )}

      {stock.headlines?.length > 0 && (
        <div className="headlines">
          <button className="toggle" onClick={() => setOpen((o) => !o)}>
            {open ? "ซ่อนข่าวต้นฉบับ" : `ดูข่าวต้นฉบับ (${stock.headlines.length})`}
          </button>
          {open && (
            <ul className="headline-list">
              {stock.headlines.map((h, i) => (
                <li key={i}>
                  <a href={h.url} target="_blank" rel="noopener noreferrer">
                    {h.title}
                  </a>
                  <span className="headline-meta">
                    {h.source} · {formatTime(h.datetime)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {stock.newsCount === 0 && (
        <span className="no-news">ไม่มีข่าวในช่วงนี้</span>
      )}
    </article>
  );
}
