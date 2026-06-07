import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" ทำให้ลิงก์ทรัพยากรเป็นแบบ relative
// จึงใช้ได้ทั้ง localhost และ GitHub Pages ที่อยู่ใต้ subpath (/repo-name/)
export default defineConfig({
  base: "./",
  plugins: [react()],
});
