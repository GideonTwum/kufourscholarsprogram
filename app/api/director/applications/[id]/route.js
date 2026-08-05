import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { isAssessorAssignableStatus } from "@/lib/assessor-assignment";

export async function GET(_request, { params }) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    let application = null;
    let { data, error } = await admin
      .from("applications")
      .select("*, profiles!applications_user_id_fkey(full_name, email, class_name, role)")
      .eq("id", id)
      .single();

    if (error) {
      const { data: appRow, error: appErr } = await admin
        .from("applications")
        .select("*")
        .eq("id", id)
        .single();

      if (appErr || !appRow) {
        return NextResponse.json(
          { error: "Application not found" },
          { status: appErr?.code === "PGRST116" ? 404 : 500 }
        );
      }

      const { data: prof } = await admin
        .from("profiles")
        .select("full_name, email, class_name, role")
        .eq("id", appRow.user_id)
        .single();

      application = { ...appRow, profiles: prof || null };
    } else {
      application = data;
    }

    if (!application) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [{ data: activeAssignment }, { data: activeAssessors }, { data: assessments }] =
      await Promise.all([
        admin
          .from("assessor_assignments")
          .select(
            "id, assessor_id, status, assigned_at, completed_at, profiles:assessor_id(id, full_name, email, is_active)"
          )
          .eq("application_id", id)
          .eq("status", "active")
          .maybeSingle(),
        admin
          .from("profiles")
          .select("id, full_name, email, is_active")
          .eq("role", "assessor")
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
        admin
          .from("application_assessments")
          .select(
            "id, stage, recommendation, overall_score, notes, submitted_at, assessor_id, assessor_name_snapshot, assessor_email_snapshot"
          )
          .eq("application_id", id)
          .order("submitted_at", { ascending: false }),
      ]);

    const latestAssessment = (assessments || [])[0] || null;

    return NextResponse.json({
      application,
      assignment: activeAssignment
        ? {
            id: activeAssignment.id,
            assessor_id: activeAssignment.assessor_id,
            status: activeAssignment.status,
            assigned_at: activeAssignment.assigned_at,
            assessor: activeAssignment.profiles || null,
          }
        : null,
      assessments: assessments || [],
      latest_assessment: latestAssessment,
      active_assessors: (activeAssessors || []).map((a) => ({
        id: a.id,
        full_name: a.full_name,
        email: a.email,
        is_active: a.is_active !== false,
      })),
      assignable: isAssessorAssignableStatus(application.status),
    });
  } catch {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
}
