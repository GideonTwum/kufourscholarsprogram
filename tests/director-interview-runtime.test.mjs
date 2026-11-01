import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fetchJson, jsonErrorMessage, readResponseJson } from "../lib/read-response-json.js";
import {
  INTERVIEW_REQUESTS_TABLE,
  LIVE_INTERVIEW_TABLES,
  classifyInterviewRequestQueryError,
  fetchDirectorInterviewRequests,
} from "../lib/director-interview-requests.js";
import { INTERVIEW_SCHEDULE_TABLE, INTERVIEW_SCHEDULE_DAYS_TABLE } from "../lib/director-interview-schedule.js";
import { INTERVIEW_ALLOCATION_TABLE } from "../lib/director-interview-allocation.js";
import { INTERVIEW_LOCATION_CONFIRMATION_TABLE } from "../lib/director-interview-location.js";
import { INTERVIEW_APPOINTMENTS_TABLE } from "../lib/director-interview-appointments.js";

const INTERVIEW_CLIENTS = [
  "components/director/DirectorInterviewRequestsPanel.jsx",
  "components/director/DirectorPublishedInterviews.jsx",
];

test("empty 500 body becomes a structured error instead of throwing", async () => {
  const res = new Response("", { status: 500, headers: { "content-type": "text/plain" } });
  const parsed = await readResponseJson(res);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.status, 500);
  assert.equal(parsed.data.code, "EMPTY_RESPONSE");
  assert.match(parsed.data.error, /empty response/i);
});

test("HTML 500 is not parsed as JSON", async () => {
  const res = new Response("<html>Internal Server Error</html>", {
    status: 500,
    headers: { "content-type": "text/html" },
  });
  const parsed = await readResponseJson(res);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.data.code, "INVALID_JSON");
  assert.match(parsed.data.error, /non-JSON/i);
});

test("valid JSON error payloads keep the server message", async () => {
  const res = new Response(JSON.stringify({ error: "Unauthorized", code: "FORBIDDEN" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
  const parsed = await readResponseJson(res);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.status, 401);
  assert.equal(parsed.data.error, "Unauthorized");
  assert.equal(parsed.data.code, "FORBIDDEN");
});

test("valid JSON success payloads stay ok", async () => {
  const res = new Response(JSON.stringify({ applicants: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const parsed = await readResponseJson(res);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.applicants, []);
});

test("fetchJson reports network failures without throwing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  try {
    const parsed = await fetchJson("/api/director/interview-allocations");
    assert.equal(parsed.ok, false);
    assert.equal(parsed.status, 0);
    assert.equal(parsed.data.code, "NETWORK_ERROR");
    assert.match(parsed.data.error, /Failed to fetch/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("jsonErrorMessage describes empty and non-JSON bodies", () => {
  assert.match(jsonErrorMessage(500, "", "text/plain"), /500/);
  assert.match(jsonErrorMessage(500, "<html>", "text/html"), /non-JSON/);
  assert.match(jsonErrorMessage(500, "{", "application/json"), /invalid JSON/i);
});

test("allocations GET no longer references INTERVIEW_APPOINTMENTS_TABLE", () => {
  const source = readFileSync(resolve("app/api/director/interview-allocations/route.js"), "utf8");
  assert.equal(source.includes("INTERVIEW_APPOINTMENTS_TABLE"), false);
  assert.match(source, /INTERVIEW_SLOTS_TABLE/);
  assert.match(source, /ALLOCATION_LOAD_FAILED/);
  assert.match(source, /requireActiveDirector/);
});

test("allocations handlers return structured JSON for unexpected failures", () => {
  const source = readFileSync(resolve("app/api/director/interview-allocations/route.js"), "utf8");
  assert.match(source, /code: "ALLOCATION_LOAD_FAILED"/);
  assert.match(source, /code: "ALLOCATION_SAVE_FAILED"/);
  assert.match(source, /error\?\.message \|\| "Failed to load interview allocations"/);
});

test("Interviews workspace clients parse fetch bodies safely", () => {
  for (const file of INTERVIEW_CLIENTS) {
    const source = readFileSync(resolve(file), "utf8");
    assert.match(source, /from ["']@\/lib\/read-response-json["']/, file);
    assert.equal(source.includes(".json()"), false, `${file} still calls Response.json()`);
  }
});

test("KSP portal does not add MetaMask or wallet dependencies", () => {
  const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of Object.keys(deps)) {
    assert.equal(/metamask|ethereum|web3|walletconnect|ethers|wagmi/i.test(name), false, name);
  }
});

function mockRequestAdmin(replies) {
  let i = 0;
  return {
    from(table) {
      assert.equal(table, INTERVIEW_REQUESTS_TABLE);
      const chain = {
        select() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return Promise.resolve(replies[Math.min(i++, replies.length - 1)]);
        },
      };
      return chain;
    },
  };
}

test("code uses the live interview table names", () => {
  assert.deepEqual(LIVE_INTERVIEW_TABLES, {
    schedules: "interview_schedules",
    schedule_days: "interview_schedule_days",
    allocations: "application_interview_allocations",
    location_confirmations: "application_interview_location_confirmations",
    interview_requests: "application_interview_requests",
    appointments: "interview_appointments",
  });
  assert.equal(INTERVIEW_SCHEDULE_TABLE, LIVE_INTERVIEW_TABLES.schedules);
  assert.equal(INTERVIEW_SCHEDULE_DAYS_TABLE, LIVE_INTERVIEW_TABLES.schedule_days);
  assert.equal(INTERVIEW_ALLOCATION_TABLE, LIVE_INTERVIEW_TABLES.allocations);
  assert.equal(INTERVIEW_LOCATION_CONFIRMATION_TABLE, LIVE_INTERVIEW_TABLES.location_confirmations);
  assert.equal(INTERVIEW_REQUESTS_TABLE, LIVE_INTERVIEW_TABLES.interview_requests);
  assert.equal(INTERVIEW_APPOINTMENTS_TABLE, LIVE_INTERVIEW_TABLES.appointments);
});

test("missing request columns fall back instead of claiming the table is absent", async () => {
  const loaded = await fetchDirectorInterviewRequests(
    mockRequestAdmin([
      { data: null, error: { code: "PGRST204", message: "Could not find the 'notification_status' column" } },
      { data: [{ id: "r1", application_id: "a1" }], error: null },
    ])
  );
  assert.equal(loaded.error, null);
  assert.equal(loaded.data[0].id, "r1");
  assert.equal(classifyInterviewRequestQueryError({ code: "PGRST204", message: "column" }), "missing_column");
  assert.equal(
    classifyInterviewRequestQueryError({ code: "PGRST205", message: "Could not find the table" }),
    "missing_table"
  );
});

test("requests GET no longer hides live query errors behind a missing-table 503", () => {
  const source = readFileSync(resolve("app/api/director/interview-requests/route.js"), "utf8");
  assert.match(source, /INTERVIEW_REQUESTS_QUERY_FAILED/);
  assert.match(source, /fetchDirectorInterviewRequests/);
  assert.equal(source.includes("Interview request table unavailable. Apply supabase-migration-interview-timetable.sql."), false);
});
