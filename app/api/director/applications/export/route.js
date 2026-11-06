import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import {
  DIRECTOR_EXPORT_APPLICATION_SELECT,
  DIRECTOR_EXPORT_LABELS,
  buildApplicantExportWorkbook,
  buildInviteeExportWorkbook,
  directorExportFilename,
  isDirectorExportType,
  selectApplicationsForExport,
  selectInviteesForExport,
} from "@/lib/director-application-export";
import {
  applyDirectorOperationalScope,
  fetchAllApplicationPages,
} from "@/lib/director-application-scope";
import { classifyDirectorApplications } from "@/lib/director-application-workflow";
import { loadDirectorAssignmentWorkflowMeta } from "@/lib/director-assignment-workflow-meta";
import { INTERVIEW_ALLOCATION_TABLE } from "@/lib/director-interview-allocation";
import { INTERVIEW_SLOTS_TABLE } from "@/lib/director-interview-batches";
import { fetchInterviewInvitees } from "@/lib/director-interview-invitees";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function exportFilters(body) {
  const filters = body?.filters && typeof body.filters === "object" ? body.filters : {};
  return {
    status: typeof filters.status === "string" ? filters.status : "",
    workflow: typeof filters.workflow === "string" ? filters.workflow : "all",
    stage: typeof filters.stage === "string" ? filters.stage : "all",
    stage2: typeof filters.stage2 === "string" ? filters.stage2 : "",
    assessor: typeof filters.assessor === "string" ? filters.assessor : "",
    q: typeof filters.q === "string" ? filters.q.slice(0, 500) : "",
  };
}

async function loadOperationalApplications(admin) {
  const { data, error } = await fetchAllApplicationPages(() => {
    const query = admin
      .from("applications")
      .select(DIRECTOR_EXPORT_APPLICATION_SELECT)
      .order("full_name", { ascending: true, nullsFirst: false });
    return applyDirectorOperationalScope(query);
  });
  if (error) return { applications: [], error };
  return { applications: data || [], error: null };
}

async function loadAllocationsByApplication(admin) {
  const { data, error } = await fetchAllApplicationPages(() =>
    admin
      .from(INTERVIEW_ALLOCATION_TABLE)
      .select("application_id, interview_slot_id")
      .order("application_id", { ascending: true })
  );
  if (error) return {};
  const map = {};
  for (const row of data || []) {
    if (row?.application_id) map[row.application_id] = row;
  }
  return map;
}

async function loadSlotsById(admin, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await admin
    .from(INTERVIEW_SLOTS_TABLE)
    .select("id, batch_name, interview_date, interview_time, end_time, status")
    .in("id", unique.slice(0, 1000));
  if (error) return {};
  return Object.fromEntries((data || []).map((slot) => [slot.id, slot]));
}

export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!isDirectorExportType(type)) {
    return NextResponse.json({ error: "Invalid export type." }, { status: 400 });
  }

  const preview = body.preview === true;
  const filters = exportFilters(body);
  const filename = directorExportFilename(type);
  const label = DIRECTOR_EXPORT_LABELS[type];

  if (type === "university_special_invitees") {
    const { data: slots } = await admin
      .from(INTERVIEW_SLOTS_TABLE)
      .select("id, batch_name, interview_date, interview_time, end_time, status, published_at, invitation_sent_at");
    const slotsById = Object.fromEntries((slots || []).map((slot) => [slot.id, slot]));
    const loaded = await fetchInterviewInvitees(admin, { slotsById });
    if (loaded.error) {
      return NextResponse.json({ error: "Could not load university special invitees." }, { status: 500 });
    }
    if (loaded.unavailable) {
      return NextResponse.json(
        {
          error:
            "University special invitee storage is not available until the interview_special_invitees migration is applied.",
        },
        { status: 503 }
      );
    }
    const invitees = selectInviteesForExport(loaded.invitees || []);
    if (!preview && invitees.length === 0) {
      return NextResponse.json(
        { error: "No records match this export.", count: 0, label, filename },
        { status: 409 }
      );
    }
    if (preview) {
      return NextResponse.json({
        ok: true,
        type,
        label,
        count: invitees.length,
        filename,
        mutates_applications: false,
      });
    }
    const workbook = await buildInviteeExportWorkbook(invitees, slotsById);
    console.info("[director-applications-export]", { type, count: workbook.count });
    return xlsxResponse(workbook.buffer, filename, workbook.count);
  }

  const loaded = await loadOperationalApplications(admin);
  if (loaded.error) {
    console.error("[director-applications-export] load failed", {
      code: loaded.error.code || null,
      message: loaded.error.message || String(loaded.error),
    });
    return NextResponse.json({ error: "Could not load applications." }, { status: 500 });
  }

  const assignmentMap = await loadDirectorAssignmentWorkflowMeta(admin, loaded.applications, {
    logLabel: "director-applications-export",
  });
  const allocations = await loadAllocationsByApplication(admin);
  const classified = classifyDirectorApplications(loaded.applications, assignmentMap).map((row) => ({
    ...row,
    allocation: allocations[row.app.id] || null,
  }));
  const selected = selectApplicationsForExport(classified, type, filters);
  if (!selected.ok) {
    return NextResponse.json({ error: selected.error || "Invalid export type." }, { status: 400 });
  }

  if (!preview && selected.rows.length === 0) {
    return NextResponse.json(
      { error: "No records match this export.", count: 0, label, filename },
      { status: 409 }
    );
  }
  if (preview) {
    return NextResponse.json({
      ok: true,
      type,
      label,
      count: selected.rows.length,
      filename,
      mutates_applications: false,
    });
  }

  const slotIds = selected.rows.flatMap((row) => [
    row.allocation?.interview_slot_id,
    row.app?.interview_slot_id,
  ]);
  const slotsById = await loadSlotsById(admin, slotIds);
  const workbook = await buildApplicantExportWorkbook(type, classified, { slotsById, filters });
  console.info("[director-applications-export]", { type, count: workbook.count });
  return xlsxResponse(workbook.buffer, filename, workbook.count);
}

function xlsxResponse(buffer, filename, count) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Export-Count": String(count),
    },
  });
}
