/**
 * Browser smoke: signed-out homepage Apply Now → /applicant-register
 * Usage: node scripts/verify-apply-now-browser.mjs
 * Prefers installed Edge/Chrome executable paths (no Playwright CDN download).
 * Dev server: npm run dev (default http://localhost:3000)
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const BASE = process.env.APPLY_SMOKE_BASE_URL || "http://localhost:3000";

const CANDIDATE_EXES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

async function launchBrowser() {
  for (const executablePath of CANDIDATE_EXES) {
    if (!existsSync(executablePath)) continue;
    try {
      return await chromium.launch({
        headless: true,
        executablePath,
        args: ["--disable-extensions"],
      });
    } catch {
      // try next
    }
  }
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ headless: true, channel });
    } catch {
      // try next
    }
  }
  throw new Error(
    "No local Edge/Chrome found for Apply Now browser smoke. Install Edge or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH."
  );
}

async function main() {
  const browser = await launchBrowser();
  const context = await browser.newContext();
  await context.clearCookies();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  const applyLink = page
    .locator('a[href="/applicant-register"]')
    .filter({ hasText: /Apply Now/i })
    .first();
  const count = await page.locator('a[href="/applicant-register"]').count();
  if (count < 1) {
    throw new Error("No Apply Now links to /applicant-register (applications may be closed)");
  }

  await applyLink.click();
  await page.waitForURL(/\/applicant-register/, { timeout: 15000 });
  const heading = await page.getByRole("heading", { name: /Applicant registration/i }).isVisible();
  if (!heading) throw new Error("Registration heading not visible");

  const url = page.url();
  if (url.includes("mfa-setup") || url.includes("mfa-challenge") || /\/director(\/|$)/.test(new URL(url).pathname)) {
    throw new Error(`Unexpected MFA/director redirect: ${url}`);
  }
  if (errors.length) {
    throw new Error(`Console page errors: ${errors.join(" | ")}`);
  }

  console.log("PASS signed-out Apply Now →", url);
  await browser.close();
}

main().catch((err) => {
  console.error("FAIL", err.message || err);
  process.exit(1);
});
