import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_ALREADY_REGISTERED,
  AUTH_EMAIL_NOT_CONFIRMED,
  AUTH_INVALID_CREDENTIALS,
  AUTH_RATE_LIMITED,
  toFriendlyAuthError,
} from "../lib/friendly-auth-error.js";

test("toFriendlyAuthError never returns raw Supabase messages", () => {
  const raw = "new row violates row-level security policy for table profiles";
  const out = toFriendlyAuthError({ message: raw }, "register");
  assert.doesNotMatch(out, /row-level security|profiles/i);
  assert.ok(out.length > 10);
});

test("maps common auth codes", () => {
  assert.equal(
    toFriendlyAuthError({ code: "email_not_confirmed", message: "Email not confirmed" }, "login"),
    AUTH_EMAIL_NOT_CONFIRMED
  );
  assert.equal(
    toFriendlyAuthError({ code: "invalid_credentials", message: "Invalid login credentials" }, "login"),
    AUTH_INVALID_CREDENTIALS
  );
  assert.equal(
    toFriendlyAuthError({ message: "User already registered" }, "register"),
    AUTH_ALREADY_REGISTERED
  );
  assert.equal(
    toFriendlyAuthError({ status: 429, message: "Email rate limit exceeded" }, "resend"),
    AUTH_RATE_LIMITED
  );
});
