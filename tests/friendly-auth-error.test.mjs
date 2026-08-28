import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_ALREADY_REGISTERED,
  AUTH_EMAIL_NOT_CONFIRMED,
  AUTH_INVALID_CREDENTIALS,
  AUTH_RATE_LIMITED,
  AUTH_REGISTER_EXISTING_HINT,
  AUTH_REGISTER_GENERIC,
  AUTH_REGISTER_RATE_LIMITED,
  AUTH_REGISTER_SYSTEM,
  classifySignupAuthFailure,
  isLikelyExistingUnconfirmedSignup,
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
  assert.match(AUTH_EMAIL_NOT_CONFIRMED, /verify your email address before signing in/i);
  assert.equal(
    toFriendlyAuthError({ code: "invalid_credentials", message: "Invalid login credentials" }, "login"),
    AUTH_INVALID_CREDENTIALS
  );
  assert.equal(
    toFriendlyAuthError({ message: "User already registered" }, "register"),
    AUTH_REGISTER_EXISTING_HINT
  );
  assert.equal(
    toFriendlyAuthError({ status: 429, message: "Email rate limit exceeded" }, "resend"),
    AUTH_RATE_LIMITED
  );
});

test("classifySignupAuthFailure distinguishes rate limit from generic register", () => {
  const limited = classifySignupAuthFailure({
    status: 429,
    message: "For security purposes, you can only request this after 60 seconds.",
  });
  assert.equal(limited.stage, "EMAIL_RATE_LIMITED");
  assert.equal(limited.friendly, AUTH_REGISTER_RATE_LIMITED);
  assert.doesNotMatch(limited.friendly, /check your details/i);

  const db = classifySignupAuthFailure({
    status: 500,
    message: "Database error saving new user",
  });
  assert.equal(db.stage, "DATABASE_TRIGGER_FAILED");
  assert.equal(db.friendly, AUTH_REGISTER_SYSTEM);

  const redirect = classifySignupAuthFailure({
    status: 400,
    message: "Redirect URL \"https://www.example.com/auth/confirm\" is not allowed",
  });
  assert.equal(redirect.stage, "REDIRECT_URL_NOT_ALLOWED");
  assert.equal(redirect.friendly, AUTH_REGISTER_SYSTEM);

  const generic = classifySignupAuthFailure({
    status: 400,
    message: "Signup requires a valid password",
  });
  assert.equal(generic.stage, "SIGNUP_AUTH_FAILED");
  assert.equal(generic.friendly, AUTH_REGISTER_GENERIC);
});

test("isLikelyExistingUnconfirmedSignup detects empty identities", () => {
  assert.equal(isLikelyExistingUnconfirmedSignup({ user: { identities: [] } }), true);
  assert.equal(
    isLikelyExistingUnconfirmedSignup({ user: { identities: [{ id: "1" }] } }),
    false
  );
  assert.equal(isLikelyExistingUnconfirmedSignup({ user: null }), false);
});

test("AUTH_ALREADY_REGISTERED remains for non-register contexts", () => {
  assert.equal(
    toFriendlyAuthError({ message: "User already registered" }, "generic"),
    AUTH_ALREADY_REGISTERED
  );
});
