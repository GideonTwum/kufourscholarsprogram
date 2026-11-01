/**
 * Read-only live schema probe via PostgREST.
 * Prints present/missing columns and RPCs. Does not write data or print secrets.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase environment for read-only probe.");
  process.exit(2);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COLUMNS = [
  ["interview_slots", "id"],
  ["interview_slots", "capacity"],
  ["interview_slots", "end_time"],
  ["interview_slots", "schedule_day_id"],
  ["interview_slots", "published_at"],
  ["interview_slots", "invitation_sent_at"],
  ["interview_slots", "status"],
  ["interview_slots", "meeting_link"],
  ["interview_schedules", "id"],
  ["interview_schedules", "appointment_duration_minutes"],
  ["interview_schedules", "physical_venue"],
  ["interview_schedules", "virtual_eligible_study_regions"],
  ["interview_schedule_days", "id"],
  ["interview_schedule_days", "interview_date"],
  ["interview_schedule_breaks", "id"],
  ["application_interview_allocations", "id"],
  ["application_interview_allocations", "interview_slot_id"],
  ["application_interview_allocations", "appointment_id"],
  ["application_interview_allocations", "interview_format"],
  ["application_interview_allocations", "invitation_sent_at"],
  ["application_interview_allocations", "invitation_delivery_status"],
  ["application_interview_location_confirmations", "id"],
  ["application_interview_location_confirmations", "study_institution"],
  ["application_interview_location_confirmations", "study_region"],
  ["application_interview_requests", "id"],
  ["application_interview_requests", "current_appointment_id"],
  ["application_interview_requests", "current_interview_slot_id"],
  ["application_interview_requests", "notification_status"],
  ["application_interview_requests", "previous_interview_date"],
  ["application_interview_allocations", "invitation_last_error"],
  ["application_interview_allocations", "allocation_state"],
  ["application_interview_allocations", "schedule_day_id"],
  ["application_interview_requests", "replacement_interview_slot_id"],
  ["application_interview_requests", "new_interview_date"],
  ["application_interview_requests", "new_interview_time"],
  ["application_interview_requests", "previous_interview_time"],
  ["application_interview_requests", "notification_sent_at"],
  ["application_interview_requests", "notification_last_error"],
  ["interview_schedules", "arrival_minutes"],
  ["interview_schedules", "whatsapp_contact"],
  ["interview_schedules", "policy_wording"],
  ["application_interview_location_confirmations", "confirmed_region"],
  ["application_interview_location_confirmations", "confirmed_town"],
];

const RPCS = [
  ["interview_slot_occupancy", { p_slot_id: "00000000-0000-0000-0000-000000000000" }],
  [
    "assign_interview_batch_applicants",
    {
      p_slot_id: "00000000-0000-0000-0000-000000000000",
      p_application_ids: [],
    },
  ],
  [
    "reschedule_interview_batch_assignment",
    {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_replacement_slot_id: "00000000-0000-0000-0000-000000000000",
    },
  ],
];

function classifyColumnError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`;
  if (/PGRST205|42P01|Could not find the table|does not exist/i.test(text) && /table/i.test(text)) {
    return "missing_table";
  }
  if (/PGRST204|42703|Could not find the .* column|column .* does not exist/i.test(text)) {
    return "missing_column";
  }
  return "query_error";
}

function classifyRpcError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`;
  if (/PGRST202|42883|Could not find the function|does not exist/i.test(text)) {
    return "missing_function";
  }
  return "present";
}

const columnResults = [];
for (const [table, column] of COLUMNS) {
  const { error } = await admin.from(table).select(column).limit(1);
  if (!error) {
    columnResults.push({ table, column, status: "present" });
    continue;
  }
  columnResults.push({
    table,
    column,
    status: classifyColumnError(error),
    code: error.code || null,
    message: error.message || null,
  });
}

const rpcResults = [];
for (const [name, args] of RPCS) {
  const { data, error } = await admin.rpc(name, args);
  if (!error) {
    rpcResults.push({ function: name, status: "present", result: data ?? null });
    continue;
  }
  const status = classifyRpcError(error);
  rpcResults.push({
    function: name,
    status,
    code: error.code || null,
    message: error.message || null,
  });
}

const { count: assignedApplications } = await admin
  .from("applications")
  .select("id", { count: "exact", head: true })
  .not("interview_slot_id", "is", null);

const { data: assignedApps } = await admin
  .from("applications")
  .select("id, status, interview_slot_id")
  .not("interview_slot_id", "is", null);

const slotIds = [...new Set((assignedApps || []).map((row) => row.interview_slot_id).filter(Boolean))];
let assignedSlots = [];
if (slotIds.length) {
  const { data } = await admin
    .from("interview_slots")
    .select("id, published_at, invitation_sent_at, capacity, end_time, status")
    .in("id", slotIds);
  assignedSlots = data || [];
}

const missingPublishedAt = assignedSlots.filter((slot) => !slot.published_at).length;
const liveInviteStatuses = new Set(["called_for_interview", "interview"]);
const liveSlotIds = new Set(
  (assignedApps || [])
    .filter((row) => liveInviteStatuses.has(row.status))
    .map((row) => row.interview_slot_id)
);
const missingInvitationSentAt = assignedSlots.filter(
  (slot) => liveSlotIds.has(slot.id) && !slot.invitation_sent_at
).length;

console.log(
  JSON.stringify(
    {
      probed_at: new Date().toISOString(),
      columns: columnResults,
      functions: rpcResults,
      counts: {
        assigned_applications: assignedApplications,
        assigned_slots: assignedSlots.length,
        assigned_slots_missing_published_at: missingPublishedAt,
        live_assigned_slots_missing_invitation_sent_at: missingInvitationSentAt,
      },
    },
    null,
    2
  )
);
