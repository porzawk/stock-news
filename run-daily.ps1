# ==========================================================================
#  สคริปต์รันประจำวัน: ดึงข่าว + สรุป + (ตัวเลือก) build เว็บ
#  ใช้กับ Windows Task Scheduler ให้รันทุกวันตอน 18:00
# ==========================================================================

# ย้ายไปที่โฟลเดอร์โปรเจกต์ (โฟลเดอร์ที่ไฟล์นี้อยู่)
Set-Location -Path $PSScriptRoot

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "[$ts] เริ่มดึงข่าวหุ้น..."

# 1) ดึงข่าว + สรุปด้วย AI -> เขียน web/public/data/news.json
node fetch-news.mjs

if ($LASTEXITCODE -ne 0) {
    Write-Host "ดึงข่าวล้มเหลว (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "เสร็จเรียบร้อย เปิดเว็บด้วย: cd web; npm run dev" -ForegroundColor Green

# --------------------------------------------------------------------------
# ตัวเลือก: ถ้าต้องการ build เว็บเป็น static ทุกวัน ให้เอา comment ออก
# Set-Location -Path (Join-Path $PSScriptRoot "web")
# npm run build
# --------------------------------------------------------------------------
