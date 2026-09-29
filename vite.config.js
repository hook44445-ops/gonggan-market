import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import { smartBannerContent } from "./src/lib/appInstall.js";

let GIT_SHA = "unknown";
try {
  GIT_SHA = execSync("git rev-parse --short HEAD").toString().trim();
} catch {}

// 아이폰 사파리 «App Store에서 받기» 배너 — 사파리는 처음 받은 HTML 의 메타만 읽는다(나중에 스크립트로 넣으면 무시).
//   VITE_APP_STORE_ID 가 있을 때만 빌드 때 index.html 에 넣는다. 앱 안(WKWebView)에서는 사파리가 아니라 안 보인다.
function appleSmartBanner(appStoreId) {
  const content = smartBannerContent(appStoreId);
  return {
    name: "apple-smart-banner",
    transformIndexHtml(html) {
      if (!content || html.includes('name="apple-itunes-app"')) return html;
      return html.replace("</head>", `  <meta name="apple-itunes-app" content="${content}" />\n  </head>`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), appleSmartBanner(env.VITE_APP_STORE_ID || process.env.VITE_APP_STORE_ID)],
    define: {
      __GIT_SHA__: JSON.stringify(GIT_SHA),
    },
    build: {
      sourcemap: true,
    },
  };
});
