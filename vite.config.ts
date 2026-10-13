import { defineConfig } from "vite";
const csp =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
export default defineConfig({
  server: { headers: { "Content-Security-Policy": csp } },
  preview: { headers: { "Content-Security-Policy": csp } },
  build: { target: "es2022" },
});
