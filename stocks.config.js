// รายชื่อหุ้นเทค NASDAQ ที่ต้องการติดตาม
// เพิ่ม/ลบได้ตามต้องการ — symbol ต้องตรงกับ Finnhub (US ticker)
export const STOCKS = [
  { symbol: "AMD", name: "AMD", sector: "Semiconductors" },
  { symbol: "SNDK", name: "SanDisk", sector: "Storage" },
  { symbol: "TSM", name: "TSMC", sector: "Semiconductors" },
  { symbol: "WDC", name: "Western Digital", sector: "Storage" },
  { symbol: "GOOGL", name: "Alphabet (Google)", sector: "Software" },
  { symbol: "NVDA", name: "NVIDIA", sector: "Semiconductors" },
  { symbol: "SPCX", name: "SpaceX", sector: "Space / Aerospace" },
  { symbol: "TSLA", name: "Tesla", sector: "EV / Tech" },
  { symbol: "RKLB", name: "Rocket Lab", sector: "Space / Aerospace" },
];

// จำนวนข่าวสูงสุดต่อหุ้นที่ส่งให้ AI สรุป (กันไม่ให้ token เยอะเกิน)
export const MAX_HEADLINES_PER_STOCK = 8;

// ดึงข่าวย้อนหลังกี่วัน (นับจากวันนี้)
export const LOOKBACK_DAYS = 2;
