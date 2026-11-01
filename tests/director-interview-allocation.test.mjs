import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  DISTANT_GHANA_REGIONS,
  UNKNOWN_LOCATION_LABEL,
  currentTownDisplay,
  currentTownKey,
  filterByDirectorCurrentTown,
  filterByDirectorResidentialRegion,
  isDistantGhanaRegion,
  residentialRegionKey,
} from "../lib/director-location-filter.js";
import {
  INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES,
  allocationRowForUpsert,
  classifyInterviewAllocation,
  confirmInterviewAllocationPreview,
  filterByDirectorInterviewAllocation,
  isEligibleForInterviewAllocation,
  persistDirectorInterviewAllocations,
  planDirectorInterviewAllocations,
  summarizeInterviewAllocationCounts,
} from "../lib/director-interview-allocation.js";
import {
  canDeleteInterviewScheduleDay,
  formatInterviewDayLabel,
  validateInterviewScheduleDay,
} from "../lib/director-interview-schedule.js";
import { directorApplicationMatchesSearch } from "../lib/director-application-workflow.js";
import { GHANA_REGIONS } from "../lib/ghana-regions.js";

function app(id, extra = {}) {
  return {
    id,
    status: extra.status ?? "stage_2_approved",
    full_name: extra.full_name || `Applicant ${id}`,
    university: extra.university || "University of Ghana",
    region: extra.region ?? "Greater Accra",
    hometown: extra.hometown ?? "Kumasi",
    current_town: extra.current_town ?? null,
    interview_slot_id: extra.interview_slot_id ?? null,
    stage_2_approved_at: extra.stage_2_approved_at ?? "2026-10-01T00:00:00.000Z",
    profiles: {
      full_name: extra.full_name || `Applicant ${id}`,
      email: extra.email || `${id}@example.com`,
    },
    ...extra,
  };
}

function row(application, allocation = null) {
  return { app: application, allocation };
}

const dayA = {
  id: "day-a",
  schedule_id: "sched-1",
  interview_date: "2026-11-17",
  start_time: "08:00",
  end_time: "16:00",
  is_active: true,
};
const dayB = {
  id: "day-b",
  schedule_id: "sched-1",
  interview_date: "2026-11-18",
  start_time: "08:00",
  end_time: "16:00",
  is_active: true,
};
const dayC = {
  id: "day-c",
  schedule_id: "sched-1",
  interview_date: "2026-12-01",
  start_time: "09:00",
  end_time: "15:00",
  is_active: true,
};
const inactiveDay = {
  id: "day-x",
  schedule_id: "sched-1",
  interview_date: "2026-11-19",
  start_time: "08:00",
  end_time: "16:00",
  is_active: false,
};
const DAYS = [dayA, dayB, dayC, inactiveDay];

const accra = app("accra");
const tamale = app("tamale", { region: "Northern", hometown: "Tamale" });
const unknownRegion = app("none", { region: null });
const pending = app("pend", { status: "stage_2_submitted" });
const rejected = app("rej", { status: "rejected" });
const queued = app("queue", { status: "interview_review_pending" });
const published = app("pub", {
  status: "called_for_interview",
  interview_slot_id: "slot-1",
});
const withTown = app("town", { current_town: "Tema", region: "Greater Accra" });

test("Interview navigation is consolidated under Interviews", () => {
  const layout = readFileSync(resolve("app/(dashboard)/layout.js"), "utf8");
  assert.match(layout, /href: "\/director\/interviews"/);
  assert.doesNotMatch(layout, /Interview allocation/);
  assert.doesNotMatch(layout, /href: "\/director\/interview-allocation"/);
  const workspace = readFileSync(
    resolve("components/director/DirectorInterviewsWorkspace.jsx"),
    "utf8"
  );
  assert.match(workspace, /Interview Batches/);
  assert.match(workspace, /Special Invitees/);
  assert.match(workspace, /Published Invitations/);
  assert.match(workspace, /Applicant Responses/);
  assert.doesNotMatch(workspace, /Applicant Allocation/);
  assert.doesNotMatch(workspace, /Interview Schedule/);
  assert.doesNotMatch(workspace, /Generate hourly/);
  const redirect = readFileSync(
    resolve("app/(dashboard)/director/interview-allocation/page.js"),
    "utf8"
  );
  assert.match(redirect, /["']tab["'], ["']batches["']/);
});

test("Location filters live in Interviews, not Applications", () => {
  const apps = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  assert.doesNotMatch(apps, /DirectorLocationFilter/);
  assert.doesNotMatch(apps, /Interview allocation:/);
  assert.doesNotMatch(apps, /Current region/);
  assert.match(apps, /filterByDirectorAssessor\(workflowScoped/);
  const batchesUi = readFileSync(
    resolve("components/director/DirectorPublishedInterviews.jsx"),
    "utf8"
  );
  assert.match(batchesUi, /DIRECTOR_REGION_FILTERS/);
  assert.match(batchesUi, /STUDY_LOCATION_UNCONFIRMED_LABEL/);
  assert.match(batchesUi, /Create Batch/);
  assert.match(batchesUi, /Assign selected/);
  assert.match(batchesUi, /Not Assigned/);
  assert.match(batchesUi, /Assigned to This Batch/);
  assert.doesNotMatch(batchesUi, /Generate hourly/);
  assert.doesNotMatch(batchesUi, /interview_slots/);
});

test("Location filtering uses confirmed study region, not hometown", () => {
  const rows = [
    row(accra),
    row(tamale),
    {
      app: tamale,
      location_confirmation: {
        confirmed_region: "Northern",
        confirmed_town: "Yendi",
        study_institution: "UDS",
        study_region: "Northern",
      },
    },
  ];
  const northern = filterByDirectorResidentialRegion(rows, "Northern");
  assert.equal(northern.length, 1);
  assert.equal(residentialRegionKey(tamale), "Northern");
  assert.equal(currentTownDisplay(tamale), UNKNOWN_LOCATION_LABEL);
  assert.notEqual(tamale.hometown, currentTownDisplay(tamale));
  assert.equal(isDistantGhanaRegion("Northern"), true);
  assert.equal(isDistantGhanaRegion("Greater Accra"), false);
});

test("Missing town/city is Not Provided", () => {
  assert.equal(currentTownKey(accra), "unknown");
  assert.equal(
    filterByDirectorCurrentTown(
      [
        row(tamale),
        {
          app: withTown,
          location_confirmation: {
            confirmed_region: "Greater Accra",
            confirmed_town: "Tema",
            study_institution: "University of Ghana",
            study_region: "Greater Accra",
          },
        },
      ],
      "Tema"
    )[0].app.id,
    "town"
  );
});

test("Creating interview dates validates uniqueness and time window", () => {
  const ok = validateInterviewScheduleDay({
    interviewDate: "2026-11-20",
    startTime: "08:00",
    endTime: "16:00",
    existingDates: ["2026-11-17"],
  });
  assert.equal(ok.ok, true);
  const dup = validateInterviewScheduleDay({
    interviewDate: "2026-11-17",
    startTime: "08:00",
    endTime: "16:00",
    existingDates: ["2026-11-17"],
  });
  assert.equal(dup.error, "duplicate_interview_date");
  const order = validateInterviewScheduleDay({
    interviewDate: "2026-11-20",
    startTime: "16:00",
    endTime: "08:00",
  });
  assert.equal(order.error, "end_time_must_be_after_start");
});

test("Editing a date can keep the same day while changing times", () => {
  const edited = validateInterviewScheduleDay({
    interviewDate: "2026-11-17",
    startTime: "09:00",
    endTime: "15:00",
    existingDates: ["2026-11-17", "2026-11-18"],
    excludeDate: "2026-11-17",
  });
  assert.equal(edited.ok, true);
  assert.equal(edited.start_time, "09:00");
});

test("Deactivating a date is a schedule-day flag, not a hard-coded calendar", () => {
  const src = readFileSync(resolve("lib/director-interview-schedule.js"), "utf8");
  assert.match(src, /is_active/);
  assert.doesNotMatch(src, /2026-11-17/);
  const sql = readFileSync(resolve("supabase/migrations/202610300001_interview_allocation.sql"), "utf8");
  assert.match(sql, /is_active boolean NOT NULL DEFAULT true/);
  assert.doesNotMatch(sql, /interview_date IN \(DATE '2026-11-17'/);
});

test("Prevent unsafe deletion of allocated dates", () => {
  assert.equal(canDeleteInterviewScheduleDay(0).ok, true);
  const blocked = canDeleteInterviewScheduleDay(4);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "date_has_allocations");
  const api = readFileSync(resolve("app/api/director/interview-schedules/route.js"), "utf8");
  assert.match(api, /canDeleteInterviewScheduleDay/);
  assert.match(api, /409/);
});

test("Dynamic interview-date filtering uses configured days", () => {
  const rows = [
    row(accra, { allocation_state: "physical", schedule_day_id: "day-a", day: dayA }),
    row(tamale, { allocation_state: "physical", schedule_day_id: "day-c", day: dayC }),
    row(queued),
  ];
  const filtered = filterByDirectorInterviewAllocation(rows, "", "2026-12-01", DAYS);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].app.id, "tamale");
  const byId = filterByDirectorInterviewAllocation(rows, "physical", "day-a", DAYS);
  assert.equal(byId[0].app.id, "accra");
});

test("Allocating applicants to configured dates", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [tamale],
    allocationsById: {},
    selectedIds: ["tamale"],
    action: "allocate_physical",
    scheduleDay: dayA,
    days: DAYS,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.changing[0].next.schedule_day_id, "day-a");
  assert.equal(plan.changing[0].next.interview_date, "2026-11-17");
  assert.equal(plan.preserveApplicationStatus, true);
  assert.equal(plan.notifyApplicants, false);
});

test("Prevent allocation to inactive or nonexistent dates", () => {
  const inactive = planDirectorInterviewAllocations({
    applications: [accra],
    selectedIds: ["accra"],
    action: "allocate_physical",
    scheduleDay: inactiveDay,
    days: DAYS,
  });
  assert.equal(inactive.error, "inactive_interview_date");
  const missing = planDirectorInterviewAllocations({
    applications: [accra],
    selectedIds: ["accra"],
    action: "allocate_physical",
    scheduleDayId: "nope",
    days: DAYS,
  });
  assert.equal(missing.error, "invalid_interview_date");
});

test("Bulk allocation applies only explicit selected IDs", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [accra, tamale, queued],
    selectedIds: ["accra", "queue"],
    action: "allocate_physical",
    scheduleDay: dayB,
    days: DAYS,
  });
  assert.equal(plan.changing.length, 2);
  assert.deepEqual(plan.changing.map((r) => r.id).sort(), ["accra", "queue"]);
});

test("Pending Remote Arrangement does not assign a date", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [tamale],
    allocationsById: {
      tamale: { allocation_state: "physical", schedule_day_id: "day-a", day: dayA },
    },
    selectedIds: ["tamale"],
    action: "pending_remote",
    days: DAYS,
  });
  assert.equal(plan.changing[0].next.allocation_state, "pending_remote");
  assert.equal(plan.changing[0].next.schedule_day_id, null);
});

test("No applicant self-booking", () => {
  const applicant = readFileSync(resolve("app/(applicant)/applicant/page.js"), "utf8");
  assert.doesNotMatch(applicant, /interview-allocations/);
  const client = readFileSync(
    resolve("components/director/DirectorPublishedInterviews.jsx"),
    "utf8"
  );
  assert.match(client, /cannot self-book/);
  const applicantInterview = readFileSync(resolve("app/api/applicant/interview/route.js"), "utf8");
  assert.match(applicantInterview, /appointment_unchanged: true/);
});

test("No automatic notifications", () => {
  const api = readFileSync(resolve("app/api/director/interview-allocations/route.js"), "utf8");
  assert.doesNotMatch(api, /sendKspEmail/);
  assert.match(api, /notify_applicants: false/);
  const preview = confirmInterviewAllocationPreview(
    planDirectorInterviewAllocations({
      applications: [accra],
      selectedIds: ["accra"],
      action: "allocate_physical",
      scheduleDay: dayA,
      days: DAYS,
    }),
    DAYS
  );
  assert.equal(preview.notifyApplicants, false);
});

test("No Stage 2 status changes", () => {
  const upsert = allocationRowForUpsert(
    "accra",
    { allocation_state: "physical", schedule_day_id: "day-a", schedule_id: "sched-1" },
    "d1"
  );
  assert.equal(Object.prototype.hasOwnProperty.call(upsert, "status"), false);
  const lib = readFileSync(resolve("lib/director-interview-allocation.js"), "utf8");
  assert.doesNotMatch(lib, /from\("applications"\)\s*\.update/);
});

test("Director-only permissions", () => {
  const alloc = readFileSync(resolve("app/api/director/interview-allocations/route.js"), "utf8");
  const sched = readFileSync(resolve("app/api/director/interview-schedules/route.js"), "utf8");
  assert.match(alloc, /requireActiveDirector/);
  assert.match(sched, /requireActiveDirector/);
  const sql = readFileSync(resolve("supabase-migration-interview-allocation.sql"), "utf8");
  assert.match(sql, /is_director\(\)/);
  assert.doesNotMatch(sql, /Applicants can read/);
});

test("Existing published interview workflows still functioning", () => {
  const publishedUi = readFileSync(
    resolve("components/director/DirectorPublishedInterviews.jsx"),
    "utf8"
  );
  assert.match(publishedUi, /Shortlisted applicants/);
  assert.match(publishedUi, /Assign selected/);
  assert.match(publishedUi, /Publish and send invitations/);
  assert.match(publishedUi, /\/api\/interview-slots/);
  const post = readFileSync(resolve("app/api/interview-slots/route.js"), "utf8");
  assert.match(post, /interview_batch_assigned/);
  assert.equal(INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES.includes("called_for_interview"), false);
  assert.equal(isEligibleForInterviewAllocation(published), false);
});

test("Metrics support a varying number of interview dates", () => {
  const rows = [
    row(accra, { allocation_state: "physical", schedule_day_id: "day-a", day: dayA }),
    row(tamale, { allocation_state: "physical", schedule_day_id: "day-c", day: dayC }),
    row(queued, { allocation_state: "pending_remote" }),
    row(unknownRegion),
    row(pending),
  ];
  const counts = summarizeInterviewAllocationCounts(rows, [dayA, dayB, dayC]);
  assert.equal(counts.eligible, 4);
  assert.equal(counts.physical, 2);
  assert.equal(counts.pending_remote, 1);
  assert.equal(counts.unallocated, 1);
  assert.equal(counts.unconfirmed_location, 4);
  assert.equal(counts.by_date.length, 3);
  assert.equal(counts.by_date.find((d) => d.day_id === "day-a").count, 1);
  assert.equal(counts.by_date.find((d) => d.day_id === "day-b").count, 0);
  assert.equal(counts.by_date.find((d) => d.day_id === "day-c").count, 1);
  const dash = readFileSync(resolve("app/(dashboard)/director/page.js"), "utf8");
  assert.match(dash, /Eligible shortlisted/);
  assert.match(dash, /Unassigned shortlisted/);
  assert.match(dash, /University invitees/);
  assert.match(dash, /Unassigned invitees/);
  assert.doesNotMatch(dash, /Day 1 — 17 Nov/);
  assert.doesNotMatch(dash, /value=\{217\}/);
  const metrics = readFileSync(resolve("app/api/director/dashboard-metrics/route.js"), "utf8");
  assert.match(metrics, /interview_allocation_by_date/);
  assert.match(metrics, /special_invitees_total/);
});

test("Moving between configured days", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [accra],
    allocationsById: {
      accra: { allocation_state: "physical", schedule_day_id: "day-a", day: dayA },
    },
    selectedIds: ["accra"],
    action: "allocate_physical",
    scheduleDay: dayB,
    days: DAYS,
  });
  assert.equal(plan.changing[0].previous.schedule_day_id, "day-a");
  assert.equal(plan.changing[0].next.schedule_day_id, "day-b");
});

test("Returning applicants to Unallocated", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [accra],
    allocationsById: {
      accra: { allocation_state: "pending_remote", schedule_day_id: null },
    },
    selectedIds: ["accra"],
    action: "unallocate",
    days: DAYS,
  });
  assert.equal(plan.changing[0].next.allocation_state, "unallocated");
});

test("Ineligible applicants are skipped", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [pending, rejected, published, accra],
    selectedIds: ["pend", "rej", "pub", "accra", "missing"],
    action: "allocate_physical",
    scheduleDay: dayA,
    days: DAYS,
  });
  assert.equal(plan.changing.length, 1);
  assert.equal(plan.changing[0].id, "accra");
});

test("persist writes allocations only", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(table);
      return {
        upsert: async (rows) => {
          calls.push({ upsert: rows });
          return { error: null };
        },
        delete() {
          return {
            in: async (_col, ids) => {
              calls.push({ delete: ids });
              return { error: null };
            },
          };
        },
      };
    },
  };
  const mixed = {
    ok: true,
    changing: [
      {
        id: "accra",
        next: { allocation_state: "physical", schedule_day_id: "day-a", schedule_id: "sched-1" },
      },
      { id: "tamale", next: { allocation_state: "unallocated", schedule_day_id: null } },
    ],
  };
  const result = await persistDirectorInterviewAllocations(client, { plan: mixed, actorId: "dir" });
  assert.equal(result.error, null);
  assert.equal(calls.includes("applications"), false);
});

test("Search composes with region filters", () => {
  const rows = [
    {
      app: app("a", { full_name: "Ama Mensah", region: "Ashanti" }),
      location_confirmation: {
        confirmed_region: "Ashanti",
        confirmed_town: "Kumasi",
        study_institution: "KNUST",
        study_region: "Ashanti",
      },
    },
    {
      app: app("b", { full_name: "Kojo Owusu", region: "Ashanti" }),
      location_confirmation: {
        confirmed_region: "Ashanti",
        confirmed_town: "Obuasi",
        study_institution: "KNUST",
        study_region: "Ashanti",
      },
    },
  ];
  const ashanti = filterByDirectorResidentialRegion(rows, "Ashanti");
  const named = ashanti.filter(({ app: application }) =>
    directorApplicationMatchesSearch(application, "Ama")
  );
  assert.equal(named[0].app.id, "a");
  assert.equal(GHANA_REGIONS.length, 16);
  for (const name of DISTANT_GHANA_REGIONS) assert.ok(GHANA_REGIONS.includes(name));
});

test("classify unallocated when no row", () => {
  assert.equal(classifyInterviewAllocation(null), "unallocated");
});

test("SQL keeps unique allocation per applicant and configurable days", () => {
  assert.ok(existsSync(resolve("supabase/migrations/202610300001_interview_allocation.sql")));
  const sql = readFileSync(resolve("supabase/migrations/202610300001_interview_allocation.sql"), "utf8");
  assert.match(sql, /interview_schedules/);
  assert.match(sql, /interview_schedule_days/);
  assert.match(sql, /UNIQUE \(application_id\)/);
  assert.match(sql, /UNIQUE \(schedule_id, interview_date\)/);
  assert.match(sql, /ON CONFLICT \(schedule_id, interview_date\) DO NOTHING/);
  assert.match(sql, /ALREADY APPLIED/);
});

test("Day labels are formatted from configured data", () => {
  assert.match(formatInterviewDayLabel("2026-11-17", "08:00", "16:00"), /17/);
  assert.match(formatInterviewDayLabel("2026-11-17", "08:00", "16:00"), /08:00–16:00/);
});
