import { NextResponse } from "next/server";
import { requireDirectorUser, getAdminOrError } from "@/lib/director-auth";

/**
 * List panel portal accounts with evaluation counts for director management.
 */
export async function GET() {
  const gate = await requireDirectorUser();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { data: members, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_active, deactivated_at, created_at")
    .eq("role", "panel")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (members || []).map((m) => m.id);
  let countsByEvaluator = {};

  if (ids.length > 0) {
    const { data: evals } = await admin
      .from("interview_evaluations")
      .select("evaluator_id")
      .in("evaluator_id", ids);

    for (const row of evals || []) {
      if (!row.evaluator_id) continue;
      countsByEvaluator[row.evaluator_id] = (countsByEvaluator[row.evaluator_id] || 0) + 1;
    }
  }

  const panel_accounts = (members || []).map((m) => ({
    ...m,
    is_active: m.is_active !== false,
    evaluation_count: countsByEvaluator[m.id] || 0,
  }));

  return NextResponse.json({ panel_accounts });
}
