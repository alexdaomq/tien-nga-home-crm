import vinext from "vinext";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

// ID thật của D1 database "tien-nga-crm" (tạo trên Cloudflare) — dùng cho bản
// self-host deploy thẳng lên Cloudflare Workers. Local win32/arm64 không dùng
// nhánh cấu hình này (đã có shim sql.js), nên không ảnh hưởng chạy máy.
const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "da227a2f-0eb8-4d65-844a-a5d891b17f32";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Cloudflare's local runtime does not ship a Windows ARM64 binary. The
  // hosted build still uses it; local preview keeps the same app without the
  // runtime binding layer on that platform.
  const canRunCloudflareLocally =
    process.env.SITES_CLOUDFLARE_BUILD === "1" ||
    !(process.platform === "win32" && process.arch === "arm64");
  const cloudflarePlugin = canRunCloudflareLocally
    ? [
        (await import("@cloudflare/vite-plugin")).cloudflare({
          viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
          config: localBindingConfig,
        }),
      ]
    : [];

  return {
    resolve: canRunCloudflareLocally
      ? undefined
      : {
          alias: {
            "cloudflare:workers": fileURLToPath(
              new URL("./build/cloudflare-workers-stub.ts", import.meta.url),
            ),
          },
        },
    // sql.js's emscripten-generated glue code does not survive Vite's SSR module
    // transform (only used by build/cloudflare-workers-stub.ts, the local-only D1 shim).
    ssr: canRunCloudflareLocally ? undefined : { external: ["sql.js"] },
    optimizeDeps: canRunCloudflareLocally ? undefined : { exclude: ["sql.js"] },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      ...cloudflarePlugin,
    ],
  };
});
