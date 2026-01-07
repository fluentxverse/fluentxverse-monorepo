import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

const PROJECT_ROOT = import.meta.dir;
const SRC_DIR = join(PROJECT_ROOT, "src");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");

// MIME types
const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// Build the app on startup
async function buildForDev() {
  const result = await Bun.build({
    entrypoints: [join(SRC_DIR, "index.tsx")],
    outdir: join(PROJECT_ROOT, ".dev"),
    minify: false,
    splitting: false,
    sourcemap: "inline",
    target: "browser",
    format: "esm",
    loader: {
      ".css": "css",
    },
  });

  if (!result.success) {
    console.error("Build failed:", result.logs);
    return null;
  }

  return result;
}

let lastBuild = await buildForDev();

// Development server
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Rebuild on each request (simple hot reload)
    lastBuild = await buildForDev();

    // Serve built files from .dev
    if (pathname.endsWith(".js") || pathname.endsWith(".css")) {
      const devFile = join(PROJECT_ROOT, ".dev", pathname.slice(1));
      if (existsSync(devFile)) {
        const ext = extname(devFile);
        return new Response(Bun.file(devFile), {
          headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
        });
      }
    }

    // Serve static files from public
    if (pathname !== "/") {
      const publicPath = join(PUBLIC_DIR, pathname);
      if (existsSync(publicPath)) {
        const ext = extname(publicPath);
        return new Response(Bun.file(publicPath), {
          headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
        });
      }
    }

    // Get built file names
    const jsFile = lastBuild?.outputs.find((o) => o.path.endsWith(".js"));
    const cssFile = lastBuild?.outputs.find((o) => o.path.endsWith(".css"));
    const jsName = jsFile ? jsFile.path.split("/").pop() : "index.js";
    const cssName = cssFile ? cssFile.path.split("/").pop() : null;

    // Serve HTML for all routes (SPA)
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0f0f23">
  <link rel="icon" type="image/png" href="/assets/img/logo/icon_logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  ${cssName ? `<link rel="stylesheet" href="/${cssName}">` : ""}
  <title>FluentXVerse - Dev</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/${jsName}"></script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`
🚀 FluentXVerse Site - Dev Server

   Local:   http://localhost:${server.port}
   
   Press Ctrl+C to stop
`);
