import test from "node:test";
import assert from "node:assert/strict";

import { validateStatusUpdateInput } from "../lib/application-status-transition.mjs";

test("rejects an unknown status", () => {
  assert.equal(validateStatusUpdateInput({ status: "unknown" }), "Invalid status");
});

test("requires a class before accepting an applicant", () => {
  assert.equal(
    validateStatusUpdateInput({ status: "accepted", class_name: "  " }),
    "class_name is required when accepting an applicant"
  );
});

test("accepts a valid acceptance request", () => {
  assert.equal(
    validateStatusUpdateInput({ status: "accepted", class_name: "Class of 2026" }),
    null
  );
});

test("requires complete interview details", () => {
  assert.match(
    validateStatusUpdateInput({
      status: "called_for_interview",
      interview: { interview_date: "2026-07-01", interview_time: "", interview_location: "Accra" },
    }),
    /Interview date/
  );
});

test("accepts complete interview details", () => {
  assert.equal(
    validateStatusUpdateInput({
      status: "called_for_interview",
      interview: {
        interview_date: "2026-07-01",
        interview_time: "09:00 GMT",
        interview_location: "Accra",
      },
    }),
    null
  );
});
