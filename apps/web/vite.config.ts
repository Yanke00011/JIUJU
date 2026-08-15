import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // 归一化：/api/xxx 与 /api/v1/xxx 都转发到后端 /api/v1/xxx
        rewrite: (path) => path.replace(/^\/api(?:\/v1)?/, "/api/v1"),
      },
    },
  },
});
