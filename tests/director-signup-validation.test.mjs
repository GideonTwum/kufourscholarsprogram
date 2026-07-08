import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeDirectorSignupInput,
  validateDirectorSignupClientFields,
} from "../lib/director-signup-validation.js";

test("normalizes director signup input", () => {
  const fields = sanitizeDirectorSignupInput({
    fullName: "  Jane Doe  ",
    email: " JANE@EXAMPLE.COM ",
    phone: "+233 (20) 123-4567",
    directorCode: " secret ",
    password: "password123",
    confirmPassword: "password123",
  });

  assert.equal(fields.fullName, "Jane Doe");
  assert.equal(fields.email, "jane@example.com");
  assert.equal(fields.directorCode, "secret");
  assert.deepEqual(validateDirectorSignupClientFields(fields), {});
});

test("rejects weak and mismatched passwords", () => {
  const errors = validateDirectorSignupClientFields({
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: "+233201234567",
    directorCode: "secret",
    password: "short",
    confirmPassword: "different",
  });

  assert.ok(errors.password);
  assert.ok(errors.confirmPassword);
});
