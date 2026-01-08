import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = import.meta.dir;
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const OUT_DIR = join(PROJECT_ROOT, "dist");

async function build() {
  console.log("🔨 Building FluentXVerse Site...\n");

  // Clean and create output directory
  if (existsSync(OUT_DIR)) {
    const { rmSync } = await import("fs");
    rmSync(OUT_DIR, { recursive: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  // Bundle the React app
  const result = await Bun.build({
    entrypoints: ["./src/index.tsx"],
    outdir: OUT_DIR,
    minify: true,
    splitting: true,
    sourcemap: "external",
    target: "browser",
    format: "esm",
    naming: {
      entry: "[name].[hash].js",
      chunk: "[name].[hash].js",
      asset: "[name].[hash][ext]",
    },
  });

  if (!result.success) {
    console.error("❌ Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // Manually bundle CSS files
  const cssFiles = ["./src/styles/main.css", "./src/styles/App.css"];
  let combinedCss = "";
  for (const cssPath of cssFiles) {
    const fullPath = join(PROJECT_ROOT, cssPath);
    if (existsSync(fullPath)) {
      combinedCss += readFileSync(fullPath, "utf-8") + "\n";
    }
  }
  
  // Generate CSS hash
  const cssHash = Bun.hash(combinedCss).toString(16).slice(0, 8);
  const cssFileName = `styles.${cssHash}.css`;
  writeFileSync(join(OUT_DIR, cssFileName), combinedCss);

  // Find the generated JS file
  const jsFile = result.outputs.find((o) => o.path.endsWith(".js") && !o.path.includes("chunk"))?.path;

  const jsFileName = jsFile ? jsFile.split("/").pop() : "index.js";

  // Generate HTML with correct script/style references
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="FluentXVerse - Learn English with expert ESL tutors. Pay with crypto, earn rewards, and track progress on-chain.">
  <meta name="keywords" content="ESL, English learning, web3, crypto, tutors, education">
  <meta name="theme-color" content="#0f0f23">
  
  <!-- Open Graph -->
  <meta property="og:title" content="FluentXVerse - Web3 ESL Learning">
  <meta property="og:description" content="Connect with expert ESL tutors worldwide. Pay with crypto, earn rewards.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://fluentxverse.com">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="FluentXVerse - Web3 ESL Learning">
  <meta name="twitter:description" content="Connect with expert ESL tutors worldwide. Pay with crypto, earn rewards.">
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="/assets/img/logo/icon_logo.png">
  
  <!-- Preload critical assets -->
  <link rel="preload" href="/assets/img/logo/icon_logo.png" as="image" type="image/png">
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  ${cssFileName ? `<link rel="stylesheet" href="/${cssFileName}">` : ""}
  
  <title>FluentXVerse - Web3 ESL Learning Platform</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/${jsFileName}"></script>
</body>
</html>`;

  // Write the HTML file
  await Bun.write(join(OUT_DIR, "index.html"), htmlTemplate);

  // Copy public assets
  if (existsSync(PUBLIC_DIR)) {
    // Copy assets folder
    const assetsDir = join(PUBLIC_DIR, "assets");
    if (existsSync(assetsDir)) {
      cpSync(assetsDir, join(OUT_DIR, "assets"), { recursive: true });
    }
    // Copy favicon
    const faviconSrc = join(PUBLIC_DIR, "favicon.png");
    if (existsSync(faviconSrc)) {
      copyFileSync(faviconSrc, join(OUT_DIR, "favicon.png"));
    }
  }

  // Create _redirects for SPA routing (for Netlify/Vercel)
  await Bun.write(join(OUT_DIR, "_redirects"), "/*    /index.html   200");

  console.log("✅ Build complete!");
  console.log(`   Output: ${OUT_DIR}`);
  console.log(`   Files:`);
  for (const output of result.outputs) {
    const size = (output.size / 1024).toFixed(2);
    console.log(`     - ${output.path.split("/").pop()} (${size} KB)`);
  }
}

build();
