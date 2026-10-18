import { build } from "esbuild";
await build({
  entryPoints: ["server/worker.js"],
  outfile: "dist/_worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
