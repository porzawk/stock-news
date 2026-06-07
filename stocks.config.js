// รายชื่อหุ้นเทค NASDAQ ที่ต้องการติดตาม
// เพิ่ม/ลบได้ตามต้องการ — symbol ต้องตรงกับ Finnhub (US ticker)
export const STOCKS = [
  { symbol: "NVDA", name: "NVIDIA", sector: "Semiconductors" },
  { symbol: "AMD", name: "AMD", sector: "Semiconductors" },
  { symbol: "INTC", name: "Intel", sector: "Semiconductors" },
  { symbol: "AAPL", name: "Apple", sector: "Consumer Tech" },
  { symbol: "MSFT", name: "Microsoft", sector: "Software" },
  { symbol: "GOOGL", name: "Alphabet (Google)", sector: "Software" },
  { symbol: "TSLA", name: "Tesla", sector: "EV / Tech" },
  { symbol: "META", name: "Meta", sector: "Software" },
  { symbol: "AMZN", name: "Amazon", sector: "E-commerce / Cloud" },
  { symbol: "AVGO", name: "Broadcom", sector: "Semiconductors" },
  { symbol: "TSM", name: "TSMC", sector: "Semiconductors" },
  { symbol: "MU", name: "Micron", sector: "Semiconductors" },
  { symbol: "QCOM", name: "Qualcomm", sector: "Semiconductors" },
];

// จำนวนข่าวสูงสุดต่อหุ้นที่ส่งให้ AI สรุป (กันไม่ให้ token เยอะเกิน)
export const MAX_HEADLINES_PER_STOCK = 8;

// ดึงข่าวย้อนหลังกี่วัน (นับจากวันนี้)
export const LOOKBACK_DAYS = 2;
