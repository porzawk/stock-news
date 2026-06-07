import { useMemo } from "react";

const SENT_COLORS = {
  positive: "#34d399",
  neutral: "#fbbf24",
  negative: "#f87171",
};
const SENT_LABELS = {
  positive: "ข่าวบวก",
  neutral: "ข่าวกลาง",
  negative: "ข่าวลบ",
};

function fmtPct(v) {
  if (typeof v !== "number") return "n/a";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// ---------- กราฟแท่ง % การเปลี่ยนแปลงราคา (ซ้าย-ขวา จากเส้นกลาง) ----------
function PriceChangeChart({ stocks }) {
  const withQuote = stocks.filter(
    (s) => s.quote && typeof s.quote.percentChange === "number"
  );
  const sorted = [...withQuote].sort(
    (a, b) => b.quote.percentChange - a.quote.percentChange
  );
  const maxAbs = Math.max(
    1,
    ...sorted.map((s) => Math.abs(s.quote.percentChange))
  );

  if (sorted.length === 0) {
    return <p className="chart-empty">ยังไม่มีข้อมูลราคา (รัน npm run fetch ใหม่)</p>;
  }

  return (
    <div className="bar-chart">
      {sorted.map((s) => {
        const pct = s.quote.percentChange;
        const widthPct = (Math.abs(pct) / maxAbs) * 50;
        const up = pct >= 0;
        return (
          <div className="bar-row" key={s.symbol}>
            <span className="bar-label">{s.symbol}</span>
            <div className="bar-track">
              <span className="bar-zero" />
              <span
                className={`bar-fill ${up ? "up" : "down"}`}
                style={
                  up
                    ? { left: "50%", width: `${widthPct}%` }
                    : { left: `${50 - widthPct}%`, width: `${widthPct}%` }
                }
              />
            </div>
            <span className={`bar-value ${up ? "up" : "down"}`}>
              {fmtPct(pct)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- โดนัทสัดส่วน sentiment ข่าว ----------
function SentimentDonut({ counts, total }) {
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circ = 2 * Math.PI * r;
  const order = ["positive", "neutral", "negative"];

  let offset = 0;
  const segments = order.map((key) => {
    const frac = total > 0 ? counts[key] / total : 0;
    const len = frac * circ;
    const seg = {
      key,
      dash: `${len} ${circ - len}`,
      offset: -offset,
    };
    offset += len;
    return seg;
  });

  return (
    <div className="donut-wrap">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#1f2937"
          strokeWidth="18"
        />
        {segments.map((seg) => (
          <circle
            key={seg.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={SENT_COLORS[seg.key]}
            strokeWidth="18"
            strokeDasharray={seg.dash}
            strokeDashoffset={seg.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 4} className="donut-num">
          {total}
        </text>
        <text x={cx} y={cy + 16} className="donut-cap">
          หุ้น
        </text>
      </svg>
      <div className="donut-legend">
        {order.map((key) => (
          <div className="legend-item" key={key}>
            <span className="dot" style={{ background: SENT_COLORS[key] }} />
            <span>{SENT_LABELS[key]}</span>
            <span className="legend-count">{counts[key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ data }) {
  const stocks = data.stocks || [];

  const stats = useMemo(() => {
    const quoted = stocks.filter(
      (s) => s.quote && typeof s.quote.percentChange === "number"
    );
    const up = quoted.filter((s) => s.quote.percentChange > 0);
    const down = quoted.filter((s) => s.quote.percentChange < 0);
    const avg =
      quoted.length > 0
        ? quoted.reduce((a, s) => a + s.quote.percentChange, 0) / quoted.length
        : null;
    const top = [...quoted].sort(
      (a, b) => b.quote.percentChange - a.quote.percentChange
    )[0];
    const bottom = [...quoted].sort(
      (a, b) => a.quote.percentChange - b.quote.percentChange
    )[0];
    return { total: stocks.length, up: up.length, down: down.length, avg, top, bottom };
  }, [stocks]);

  const sentCounts = useMemo(() => {
    const c = { positive: 0, neutral: 0, negative: 0 };
    for (const s of stocks) c[s.sentiment] = (c[s.sentiment] || 0) + 1;
    return c;
  }, [stocks]);

  return (
    <div className="dashboard">
      <div className="stat-tiles">
        <div className="tile">
          <span className="tile-label">หุ้นที่ติดตาม</span>
          <span className="tile-value">{stats.total}</span>
        </div>
        <div className="tile">
          <span className="tile-label">ราคาขึ้นวันนี้</span>
          <span className="tile-value up">▲ {stats.up}</span>
        </div>
        <div className="tile">
          <span className="tile-label">ราคาลงวันนี้</span>
          <span className="tile-value down">▼ {stats.down}</span>
        </div>
        <div className="tile">
          <span className="tile-label">เปลี่ยนแปลงเฉลี่ย</span>
          <span
            className={`tile-value ${stats.avg >= 0 ? "up" : "down"}`}
          >
            {fmtPct(stats.avg)}
          </span>
        </div>
      </div>

      <div className="charts-row">
        <section className="chart-card wide">
          <h3>% การเปลี่ยนแปลงราคาวันนี้</h3>
          <PriceChangeChart stocks={stocks} />
        </section>

        <section className="chart-card">
          <h3>สัดส่วนทิศทางข่าว</h3>
          <SentimentDonut counts={sentCounts} total={stats.total} />
          {stats.top && (
            <div className="mover-note">
              <div>
                <span className="mover-label">ขึ้นมากสุด</span>
                <span className="up">
                  {stats.top.symbol} {fmtPct(stats.top.quote.percentChange)}
                </span>
              </div>
              <div>
                <span className="mover-label">ลงมากสุด</span>
                <span className="down">
                  {stats.bottom.symbol} {fmtPct(stats.bottom.quote.percentChange)}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      {data.marketOverview && (
        <section className="overview">
          <h2>ภาพรวมตลาด (สรุปโดย AI)</h2>
          <p>{data.marketOverview}</p>
        </section>
      )}
    </div>
  );
}
