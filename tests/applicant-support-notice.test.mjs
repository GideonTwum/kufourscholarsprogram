import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  APPLICANT_SUPPORT_EMAIL,
  APPLICANT_SUPPORT_TITLE,
  applicantSupportMailto,
} from "../lib/applicant-support.js";

test("applicant support config is centralized", () => {
  assert.equal(APPLICANT_SUPPORT_EMAIL, "twumgideonasare@gmail.com");
  assert.equal(APPLICANT_SUPPORT_TITLE, "Need Help With Your Application?");
  assert.equal(applicantSupportMailto(), "mailto:twumgideonasare@gmail.com");
});

test("ApplicantSupportNotice uses mailto and break-all for mobile", () => {
  const src = readFileSync(
    resolve("components/applicant/ApplicantSupportNotice.jsx"),
    "utf8"
  );
  assert.match(src, /APPLICANT_SUPPORT_EMAIL/);
  assert.match(src, /APPLICANT_SUPPORT_TITLE/);
  assert.match(src, /mailto/);
  assert.match(src, /break-all/);
  assert.match(src, /applicantSupportMailto/);
});

test("support notice is wired on auth and applicant surfaces", () => {
  const register = readFileSync(resolve("app/(auth)/applicant-register/page.js"), "utf8");
  const verify = readFileSync(resolve("app/(auth)/applicant/verify-email/page.js"), "utf8");
  const portal = readFileSync(resolve("components/auth/PortalLoginForm.jsx"), "utf8");
  const dash = readFileSync(resolve("app/(applicant)/applicant/page.js"), "utf8");
  const app = readFileSync(resolve("app/(applicant)/applicant/application/page.js"), "utf8");
  const contact = readFileSync(resolve("components/landing/Contact.jsx"), "utf8");
  const footer = readFileSync(resolve("components/landing/Footer.jsx"), "utf8");

  assert.match(register, /ApplicantSupportNotice/);
  assert.match(verify, /ApplicantSupportNotice/);
  assert.match(portal, /expectedRole === "applicant".*ApplicantSupportNotice|ApplicantSupportNotice[\s\S]*expectedRole === "applicant"/);
  assert.match(portal, /ApplicantSupportNotice/);
  assert.match(dash, /ApplicantSupportNotice/);
  assert.match(app, /ApplicantSupportNotice/);
  assert.match(contact, /ApplicantSupportNotice/);
  assert.match(footer, /ApplicantSupportNotice/);
});
