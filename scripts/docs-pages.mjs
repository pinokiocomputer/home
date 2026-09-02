#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, promises as fs, watch } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const docsDirectory = path.join(repositoryRoot, "docs");
const templatePath = path.join(docsDirectory, "index.html");
const manifestPath = path.join(docsDirectory, "pages.json");

function fail(message) {
  throw new Error(`[docs-pages] ${message}`);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveInside(parent, relativePath, label) {
  const resolved = path.resolve(parent, relativePath);
  if (!isInside(parent, resolved)) {
    fail(`${label} must stay inside ${path.relative(repositoryRoot, parent) || "."}`);
  }
  return resolved;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceOnce(source, search, replacement, label) {
  const matches = typeof search === "string"
    ? source.split(search).length - 1
    : [...source.matchAll(new RegExp(search.source, search.flags.includes("g") ? search.flags : `${search.flags}g`))].length;

  if (matches !== 1) {
    fail(`Expected one ${label} marker in docs/index.html, found ${matches}`);
  }
  return source.replace(search, replacement);
}

async function writeIfChanged(filePath, content) {
  let existing = null;
  try {
    existing = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing === content) return false;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return true;
}

async function readManifest() {
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    fail(`Could not read docs/pages.json: ${error.message}`);
  }

  let siteUrl;
  try {
    siteUrl = new URL(manifest.siteUrl);
  } catch {
    fail("siteUrl must be an absolute URL");
  }
  if (!/^https?:$/.test(siteUrl.protocol)) fail("siteUrl must use HTTP or HTTPS");
  siteUrl.pathname = siteUrl.pathname.replace(/\/$/, "");
  siteUrl.search = "";
  siteUrl.hash = "";

  if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) {
    fail("pages must contain at least one companion page");
  }

  const seenSlugs = new Set();
  const pages = [];
  for (const entry of manifest.pages) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug || "")) {
      fail(`Invalid page slug: ${entry.slug || "(missing)"}`);
    }
    if (seenSlugs.has(entry.slug)) fail(`Duplicate page slug: ${entry.slug}`);
    seenSlugs.add(entry.slug);

    for (const field of ["source", "title", "headline", "description", "ogImage", "ogImageAlt"]) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) {
        fail(`${entry.slug}.${field} must be a non-empty string`);
      }
    }
    if (!Number.isInteger(entry.ogImageWidth) || entry.ogImageWidth <= 0 ||
        !Number.isInteger(entry.ogImageHeight) || entry.ogImageHeight <= 0) {
      fail(`${entry.slug} must have positive integer OG image dimensions`);
    }

    const sourcePath = resolveInside(docsDirectory, entry.source, `${entry.slug}.source`);
    const imageUrl = new URL(entry.ogImage, siteUrl);
    if (!imageUrl.pathname.startsWith("/docs/")) {
      fail(`${entry.slug}.ogImage must be an absolute /docs/ path`);
    }
    const imagePath = resolveInside(repositoryRoot, imageUrl.pathname.slice(1), `${entry.slug}.ogImage`);
    if (!isInside(docsDirectory, imagePath)) {
      fail(`${entry.slug}.ogImage must point inside docs/`);
    }

    await Promise.all([
      fs.access(sourcePath),
      fs.access(imagePath)
    ]).catch((error) => fail(`${entry.slug} references a missing file: ${error.path || error.message}`));

    pages.push({
      ...entry,
      sourcePath,
      imagePath,
      canonicalUrl: new URL(`/docs/${entry.slug}/`, siteUrl).href,
      absoluteImageUrl: imageUrl.href
    });
  }

  return { siteUrl: siteUrl.href.replace(/\/$/, ""), pages };
}

async function renderPage(template, page) {
  const markdown = await fs.readFile(page.sourcePath, "utf8");
  const cacheKey = createHash("sha256").update(markdown).digest("hex").slice(0, 12);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const imageAlt = escapeHtml(page.ogImageAlt);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.headline,
    description: page.description,
    url: page.canonicalUrl,
    image: page.absoluteImageUrl,
    isPartOf: {
      "@type": "TechArticle",
      name: "Pinokio Manual",
      url: new URL("/docs/", page.canonicalUrl).href
    },
    publisher: {
      "@type": "Organization",
      name: "Pinokio",
      url: "https://pinokio.co"
    }
  };

  let html = template;
  html = replaceOnce(html, "<!doctype html>", "<!doctype html>\n<!-- Generated by scripts/docs-pages.mjs. Do not edit directly. -->", "doctype");
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, "title");
  html = replaceOnce(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`, "description");
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${page.canonicalUrl}">`, "canonical URL");
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`, "Twitter title");
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${description}">`, "Twitter description");
  html = replaceOnce(html, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${page.absoluteImageUrl}">\n  <meta name="twitter:image:alt" content="${imageAlt}">`, "Twitter image");
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${page.canonicalUrl}">`, "Open Graph URL");
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`, "Open Graph title");
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`, "Open Graph description");
  html = replaceOnce(
    html,
    /<meta property="og:image" content="[^"]*">/,
    `<meta property="og:image" content="${page.absoluteImageUrl}">\n  <meta property="og:image:type" content="image/png">\n  <meta property="og:image:width" content="${page.ogImageWidth}">\n  <meta property="og:image:height" content="${page.ogImageHeight}">\n  <meta property="og:image:alt" content="${imageAlt}">`,
    "Open Graph image"
  );
  html = replaceOnce(
    html,
    /  <script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `  <script type="application/ld+json">\n${JSON.stringify(structuredData, null, 2).split("\n").map((line) => `    ${line}`).join("\n")}\n  </script>`,
    "structured data"
  );

  html = replaceOnce(html, 'href="favicon.ico"', 'href="../favicon.ico"', "favicon");
  html = replaceOnce(html, 'href="vendor/docsify-vue.css"', 'href="../vendor/docsify-vue.css"', "Docsify stylesheet");
  html = replaceOnce(html, 'href="prism2.css"', 'href="../prism2.css"', "Prism stylesheet");
  html = replaceOnce(html, /href="style\.css([^"]*)"/, 'href="../style.css$1"', "site stylesheet");
  html = replaceOnce(html, '<a class="docs-brand" href="../"', '<a class="docs-brand" href="../../"', "brand link");
  html = replaceOnce(html, 'src="android-chrome-192x192.png"', 'src="../android-chrome-192x192.png"', "brand image");
  html = replaceOnce(html, 'href="../download.html"', 'href="../../download.html"', "download link");
  html = replaceOnce(html, "Loading the Pinokio manual…", `Loading ${escapeHtml(page.headline)}…`, "loading message");
  html = replaceOnce(html, "JavaScript is required for the interactive manual.", `JavaScript is required for the interactive ${escapeHtml(page.headline)} guide.`, "noscript message");
  html = replaceOnce(html, '<a href="README.md">Read the Markdown source instead.</a>', `<a href="../${escapeHtml(page.source)}">Read the Markdown source instead.</a>`, "noscript source link");
  html = replaceOnce(
    html,
    '      homepage: "README.md?v=20260826-1",',
    `      basePath: "/docs/",\n      homepage: "${page.source}?v=${cacheKey}",`,
    "Docsify homepage"
  );
  html = replaceOnce(html, '        paths: ["/", "/disk-saver"],', `        paths: ["/${page.slug}"],`, "search paths");
  html = replaceOnce(html, '        placeholder: "Search the manual",', `        placeholder: "Search ${page.headline}",`, "search placeholder");
  html = replaceOnce(html, '        namespace: "pinokio-manual-v3"', `        namespace: "pinokio-${page.slug}-v1"`, "search namespace");
  html = replaceOnce(html, /src="companion-pages\.js([^"]*)"/, 'src="../companion-pages.js$1"', "companion route script");
  html = replaceOnce(html, /src="plugin\.js([^"]*)"/, 'src="../plugin.js$1"', "site plugin");
  html = html.replace(/src="vendor\//g, 'src="../vendor/');

  return `${html.trimEnd()}\n`;
}

function renderRouteMap(pages) {
  const routes = Object.fromEntries(pages.map((page) => [`/${page.slug}`, `/docs/${page.slug}/`]));
  return `// Generated by scripts/docs-pages.mjs. Do not edit directly.\nwindow.PINOKIO_DOC_COMPANION_PAGES = Object.freeze(${JSON.stringify(routes, null, 2)});\n`;
}

function renderSitemap(siteUrl, pages) {
  const urls = [new URL("/docs/", siteUrl).href, ...pages.map((page) => page.canonicalUrl)];
  const entries = urls.map((url) => `  <url>\n    <loc>${escapeHtml(url)}</loc>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generated by scripts/docs-pages.mjs. Do not edit directly. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

async function build() {
  const [{ siteUrl, pages }, template] = await Promise.all([
    readManifest(),
    fs.readFile(templatePath, "utf8")
  ]);
  const writes = [];
  const activeSlugs = new Set(pages.map((page) => page.slug));

  for (const entry of await fs.readdir(docsDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory() || activeSlugs.has(entry.name)) continue;
    const staleOutput = path.join(docsDirectory, entry.name, "index.html");
    try {
      const beginning = (await fs.readFile(staleOutput, "utf8")).slice(0, 160);
      if (beginning.includes("Generated by scripts/docs-pages.mjs")) {
        await fs.unlink(staleOutput);
        console.log(`[docs-pages] Removed stale generated page: docs/${entry.name}/index.html`);
      }
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "EISDIR") throw error;
    }
  }

  for (const page of pages) {
    const outputPath = path.join(docsDirectory, page.slug, "index.html");
    writes.push(writeIfChanged(outputPath, await renderPage(template, page)));
  }
  writes.push(writeIfChanged(path.join(docsDirectory, "companion-pages.js"), renderRouteMap(pages)));
  writes.push(writeIfChanged(path.join(docsDirectory, "sitemap.xml"), renderSitemap(siteUrl, pages)));

  const changed = (await Promise.all(writes)).filter(Boolean).length;
  console.log(`[docs-pages] Built ${pages.length} companion page${pages.length === 1 ? "" : "s"} (${changed} file${changed === 1 ? "" : "s"} changed)`);
  return { pages, watchPaths: [manifestPath, templatePath, ...pages.flatMap((page) => [page.sourcePath, page.imagePath])] };
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8"
};

async function serveFile(request, response) {
  if (!request.url || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  let filePath = path.resolve(repositoryRoot, `.${pathname}`);
  if (filePath !== repositoryRoot && !isInside(repositoryRoot, filePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    let stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      if (!pathname.endsWith("/")) {
        response.writeHead(308, { Location: `${pathname}/${new URL(request.url, "http://localhost").search}` });
        response.end();
        return;
      }
      filePath = path.join(filePath, "index.html");
      stats = await fs.stat(filePath);
    }
    if (!stats.isFile()) throw Object.assign(new Error("Not found"), { code: "ENOENT" });

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": "no-store"
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    console.error(error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
}

function readPort(argumentsList) {
  const equalsArgument = argumentsList.find((argument) => argument.startsWith("--port="));
  const portIndex = argumentsList.indexOf("--port");
  const rawPort = equalsArgument?.slice("--port=".length) || (portIndex >= 0 ? argumentsList[portIndex + 1] : "8080");
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`Invalid port: ${rawPort}`);
  return port;
}

async function develop(argumentsList) {
  let buildResult = await build();
  let fileWatchers = [];
  let rebuildTimer = null;
  let closing = false;

  const attachWatchers = () => {
    fileWatchers.forEach((fileWatcher) => fileWatcher.close());
    if (closing) return;
    fileWatchers = buildResult.watchPaths.map((filePath) => watch(filePath, () => {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(async () => {
        if (closing) return;
        try {
          buildResult = await build();
          attachWatchers();
        } catch (error) {
          console.error(error.message);
        }
      }, 80);
    }));
  };
  attachWatchers();

  const port = readPort(argumentsList);
  const server = http.createServer((request, response) => {
    serveFile(request, response).catch((error) => {
      console.error(error);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  server.on("error", (error) => {
    clearTimeout(rebuildTimer);
    fileWatchers.forEach((fileWatcher) => fileWatcher.close());
    if (error.code === "EADDRINUSE") {
      console.error(`[docs-pages] Port ${port} is already in use. Stop the other server or pass --port <number>.`);
    } else if (error.code === "EACCES" || error.code === "EPERM") {
      console.error(`[docs-pages] Cannot listen on 127.0.0.1:${port}: ${error.message}`);
    } else {
      console.error(`[docs-pages] Local server failed: ${error.message}`);
    }
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`[docs-pages] Local site: http://127.0.0.1:${port}/docs/`);
    buildResult.pages.forEach((page) => {
      console.log(`[docs-pages] ${page.headline}: http://127.0.0.1:${port}/docs/${page.slug}/`);
    });
  });

  const close = () => {
    closing = true;
    clearTimeout(rebuildTimer);
    fileWatchers.forEach((fileWatcher) => fileWatcher.close());
    server.close(() => process.exit(0));
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

const [command = "build", ...argumentsList] = process.argv.slice(2);
try {
  if (command === "build") await build();
  else if (command === "dev") await develop(argumentsList);
  else fail(`Unknown command: ${command}. Use build or dev.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
