/**
 * Export the v3 live companion step 0 (Overall Demo) FlowStory embed to assets/overall-architecture.png.
 * Reveals all baseline hops (End-key equivalent) before capture. No cluster required.
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const OUTPUT_PATH = path.join(ROOT_DIR, "assets", "overall-architecture.png");

const HTTP_PORT = Number(process.env.ARCH_DIAGRAM_HTTP_PORT || 18765);
const PAGE_URL = `http://127.0.0.1:${HTTP_PORT}/demo/v3/live.html#step-0`;
const VIEWPORT = { width: 1600, height: 1100 };
const DIAGRAM_SELECTOR = ".nr-v3-overall-mounted .fs-overall-canvas-wrap";

const LAYERS_DOCK_MODE_KEY = "agentops-layers-dock-mode";
const LAYERS_DOCK_VISIBLE_KEY = "agentops-layers-dock-visible";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for static server at ${url}`);
}

function startStaticServer() {
  const child = spawn("python3", ["-m", "http.server", String(HTTP_PORT)], {
    cwd: DOCS_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.on("error", (err) => {
    console.error("Failed to start python3 http.server:", err.message);
    process.exit(1);
  });

  return child;
}

async function exportDiagram() {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  const server = startStaticServer();
  let browser;

  try {
    await waitForServer(PAGE_URL.split("#")[0]);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    });

    await page.addInitScript(
      ({ modeKey, visibleKey }) => {
        localStorage.clear();
        localStorage.setItem(modeKey, "off");
        localStorage.setItem(visibleKey, "false");
      },
      {
        modeKey: LAYERS_DOCK_MODE_KEY,
        visibleKey: LAYERS_DOCK_VISIBLE_KEY,
      },
    );

    await page.goto(PAGE_URL, { waitUntil: "networkidle" });

    await page.waitForFunction(() => document.body.classList.contains("nr-v3-step-0"));
    await page.waitForSelector(".nr-v3-overall-mounted", { state: "attached" });
    await page.waitForFunction(() => Boolean(window.__flowstory?._canvas));
    await page.evaluate(() => document.body.classList.add("light"));

    await page.evaluate(() => {
      const viz = window.__flowstory;
      if (!viz?._diagram?.flows) {
        throw new Error("FlowStory diagram not loaded");
      }
      viz.closeOverlay?.();
      const flowId = viz.state.activeFlow || viz._diagram.defaultFlow || "baseline";
      const steps = viz._diagram.flows[flowId]?.steps;
      if (!steps?.length) {
        throw new Error(`No steps for flow: ${flowId}`);
      }
      viz.jumpTo(steps.length - 1);
      if (viz.state.currentStepDone !== steps.length) {
        throw new Error(
          `Expected all hops revealed (${steps.length}), got ${viz.state.currentStepDone}`,
        );
      }
    });

    const diagram = page.locator(DIAGRAM_SELECTOR);
    await diagram.waitFor({ state: "visible" });

    // Allow jumpTo to paint every hop, logos, and legend.
    await page.waitForTimeout(1200);

    await diagram.screenshot({
      path: OUTPUT_PATH,
      animations: "disabled",
      scale: "css",
    });

    console.log(`Wrote ${OUTPUT_PATH}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    server.kill("SIGTERM");
    await sleep(300);
    if (!server.killed) {
      server.kill("SIGKILL");
    }
  }
}

exportDiagram().catch((err) => {
  console.error(err);
  process.exit(1);
});
