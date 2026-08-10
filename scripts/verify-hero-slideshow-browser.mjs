/**
 * Browser smoke: static homepage hero — real photo panel + Apply CTA clickable.
 * No slideshow expectations.
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const BASE = process.env.HERO_SMOKE_BASE_URL || "http://localhost:3000";

const CANDIDATE_EXES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

async function launchBrowser() {
  for (const executablePath of CANDIDATE_EXES) {
    if (!existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ headless: true, executablePath });
    } catch {
      /* try next */
    }
  }
  return chromium.launch({ headless: true, channel: "msedge" });
}

async function main() {
  const browser = await launchBrowser();
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);

  const headline = await page.getByRole("heading", { name: /Rewiring Future/i }).isVisible();
  await page.getByRole("link", { name: /Meet Our Scholars/i }).first().waitFor({ state: "visible" });

  const heroApply = page
    .locator("section a")
    .filter({ hasText: /Apply Now|Applications Closed|Prepare to apply/i })
    .first();
  await heroApply.click({ trial: true });

  const meta = await page.evaluate(() => {
    const section = document.querySelector("section");
    const imgs = [...(section?.querySelectorAll("img") || [])];
    const overlays = [...(section?.querySelectorAll(".pointer-events-none") || [])];
    const srcs = imgs.map((i) => i.getAttribute("src") || "");
    return {
      imgCount: imgs.length,
      overlayCount: overlays.length,
      srcs,
      usesFormalPhoto: srcs.some((s) => s.includes("scholars-formal-1")),
      usesMockup: srcs.some((s) => /ksp-group-hero|ChatGPT/i.test(s)),
    };
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  const mobileOk = await page.getByRole("heading", { name: /Rewiring Future/i }).isVisible();

  if (!headline) throw new Error("Headline not visible");
  if (!mobileOk) throw new Error("Headline not visible at 375px");
  if (!meta.usesFormalPhoto) throw new Error("Real scholars-formal-1 photo not rendered");
  if (meta.usesMockup) throw new Error("Mockup image must not be used at runtime");
  if (meta.overlayCount < 1) throw new Error("No pointer-events-none overlay layers");
  if (errors.length) throw new Error(`Page errors: ${errors.join(" | ")}`);

  console.log("PASS static hero smoke", meta);
  await browser.close();
}

main().catch((err) => {
  console.error("FAIL", err.message || err);
  process.exit(1);
});
