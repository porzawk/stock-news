import { useEffect, useMemo, useState } from "react";

const SENT_COLORS = {
  positive: "#34d399",
  neutral: "#fbbf24",
  negative: "#f87171",
};
const SENT_ICON = { positive: "▲", neutral: "■", negative: "▼" };

function fmtPct(v) {
  if (typeof v !== "number") return "n/a";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// ค่าสัมประสิทธิ์สหสัมพันธ์ Pearson ระหว่าง x[] กับ y[]
// คืน null ถ้าข้อมูลน้อยเกินไปหรือไม่มีความแปรปรวน
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

// แปลค่า correlation เป็นข้อความไทย
function describeCorr(r) {
  if (r == null) return { text: "ข้อมูลยังไม่พอ", cls: "muted" };
  const a = Math.abs(r);
  const dir = r > 0 ? "ข่าวบวก→ราคาขึ้น" : "ข่าวบวก→ราคาลง";
  let strength = "แทบไม่สัมพันธ์";
  if (a >= 0.7) strength = "สัมพันธ์สูง";
  else if (a >= 0.4) strength = "สัมพันธ์ปานกลาง";
  else if (a >= 0.2) strength = "สัมพันธ์น้อย";
  const cls = a < 0.2 ? "muted" : r > 0 ? "up" : "down";
  return { text: a < 0.2 ? strength : `${strength} (${dir})`, cls };
}

export default function History() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/history.json?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error("ยังไม่มีข้อมูลย้อนหลัง");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  // จัดกลุ่มตามหุ้น + คำนวณสถิติ
  const perSymbol = useMemo(() => {
    const rows = data?.rows || [];
    const bySym = new Map();
    for (const r of rows) {
      if (typeof r.percentChange !== "number") continue;
      if (!bySym.has(r.symbol))
        bySym.set(r.symbol, { symbol: r.symbol, name: r.name, pts: [] });
      bySym.get(r.symbol).pts.push(r);
    }
    return [...bySym.values()]
      .map((g) => {
        const scores = g.pts.map((p) => p.sentimentScore);
        const pcts = g.pts.map((p) => p.percentChange);
        const r = pearson(scores, pcts);
        // hit rate: เฉพาะวันที่ข่าวไม่เป็นกลาง ทิศข่าวตรงกับทิศราคาไหม
        const directional = g.pts.filter((p) => p.sentimentScore !== 0);
        const hits = directional.filter(
          (p) => Math.sign(p.sentimentScore) === Math.sign(p.percentChange)
        ).length;
        const hitRate =
          directional.length > 0 ? hits / directional.length : null;
        const avgPct =
          pcts.reduce((a, b) => a + b, 0) / (pcts.length || 1);
        return {
          symbol: g.symbol,
          name: g.name,
          days: g.pts.length,
          corr: r,
          hitRate,
          directionalDays: directional.length,
          avgPct,
        };
      })
      .sort((a, b) => (b.corr ?? -2) - (a.corr ?? -2));
  }, [data]);

  // correlation รวมทุกหุ้น
  const overall = useMemo(() => {
    const rows = (data?.rows || []).filter(
      (r) => typeof r.percentChange === "number"
    );
    const r = pearson(
      rows.map((x) => x.sentimentScore),
      rows.map((x) => x.percentChange)
    );
    const dates = new Set(rows.map((x) => x.date));
    return { corr: r, records: rows.length, days: dates.size };
  }, [data]);

  // จัดกลุ่มตามวัน (ใหม่สุดก่อน) สำหรับตารางไล่รายวัน
  const byDate = useMemo(() => {
    const rows = data?.rows || [];
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.date)) m.set(r.date, []);
      m.get(r.date).push(r);
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => a.symbol.localeCompare(b.symbol)),
      }));
  }, [data]);

  if (error) {
    return (
      <div className="history">
        <div className="empty-state">
          <h2>📭 ยังไม่มีข้อมูลย้อนหลัง</h2>
          <p>
            หน้านี้จะมีข้อมูลหลังจากสคริปต์รันและบันทึกลง Neon ไปแล้วอย่างน้อย 1 วัน
            <br />
            (ต้องตั้งค่า <code>DATABASE_URL</code> ใน <code>.env</code> ก่อน)
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="history">
        <div className="empty-state">
          <div className="spinner" />
          <p>กำลังโหลดประวัติ...</p>
        </div>
      </div>
    );
  }

  const ov = describeCorr(overall.corr);

  return (
    <div className="history">
      <div className="stat-tiles">
        <div className="tile">
          <span className="tile-label">จำนวนวันที่เก็บ</span>
          <span className="tile-value">{overall.days}</span>
        </div>
        <div className="tile">
          <span className="tile-label">จำนวนข้อมูล (แถว)</span>
          <span className="tile-value">{overall.records}</span>
        </div>
        <div className="tile">
          <span className="tile-label">correlation รวม</span>
          <span className={`tile-value ${ov.cls}`}>
            {overall.corr == null ? "—" : overall.corr.toFixed(2)}
          </span>
        </div>
      </div>

      <section className="overview">
        <h2>ข่าวบวก/ลบ มีผลกับราคาไหม?</h2>
        <p>
          ค่า correlation รวมอยู่ที่{" "}
          <b className={ov.cls}>
            {overall.corr == null ? "—" : overall.corr.toFixed(2)}
          </b>{" "}
          — {ov.text}. ค่าเข้าใกล้ <b>+1</b> = วันที่ข่าวบวกราคามักขึ้น,
          เข้าใกล้ <b>-1</b> = ข่าวบวกราคากลับลง, ใกล้ <b>0</b> = ข่าวกับราคาแทบไม่เกี่ยวกัน.
          <br />
          <span className="muted-note">
            หมายเหตุ: เทียบทิศข่าวของวันนั้นกับ % เปลี่ยนแปลงราคาเทียบราคาปิดวันก่อน —
            ยิ่งเก็บหลายวัน ค่ายิ่งน่าเชื่อถือ
          </span>
        </p>
      </section>

      <section className="chart-card wide">
        <h3>สรุปรายหุ้น</h3>
        <div className="table-wrap">
          <table className="hist-table">
            <thead>
              <tr>
                <th>หุ้น</th>
                <th>วันที่เก็บ</th>
                <th>%เปลี่ยนเฉลี่ย</th>
                <th>correlation</th>
                <th>ข่าวตรงทิศราคา</th>
                <th>การตีความ</th>
              </tr>
            </thead>
            <tbody>
              {perSymbol.map((s) => {
                const d = describeCorr(s.corr);
                return (
                  <tr key={s.symbol}>
                    <td>
                      <b>{s.symbol}</b>
                      <span className="cell-sub">{s.name}</span>
                    </td>
                    <td>{s.days}</td>
                    <td className={s.avgPct >= 0 ? "up" : "down"}>
                      {fmtPct(s.avgPct)}
                    </td>
                    <td className={d.cls}>
                      {s.corr == null ? "—" : s.corr.toFixed(2)}
                    </td>
                    <td>
                      {s.hitRate == null
                        ? "—"
                        : `${Math.round(s.hitRate * 100)}% (${s.directionalDays} วัน)`}
                    </td>
                    <td className={d.cls}>{d.text}</td>
                  </tr>
                );
              })}
              {perSymbol.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    ยังไม่มีข้อมูลพอจะสรุป
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="chart-card wide">
        <h3>ไล่รายวัน (ใหม่สุดก่อน)</h3>
        <div className="day-list">
          {byDate.map(({ date, items }) => (
            <div className="day-row" key={date}>
              <div className="day-date">{date}</div>
              <div className="day-chips">
                {items.map((it) => {
                  const up =
                    typeof it.percentChange === "number" &&
                    it.percentChange >= 0;
                  return (
                    <span
                      className="day-chip"
                      key={it.symbol}
                      title={`${it.sentiment} · ${fmtPct(it.percentChange)}`}
                    >
                      <span
                        className="chip-dot"
                        style={{ background: SENT_COLORS[it.sentiment] }}
                      >
                        {SENT_ICON[it.sentiment]}
                      </span>
                      <b>{it.symbol}</b>
                      <span className={up ? "up" : "down"}>
                        {fmtPct(it.percentChange)}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          {byDate.length === 0 && (
            <p className="muted">ยังไม่มีข้อมูลรายวัน</p>
          )}
        </div>
      </section>
    </div>
  );
}
