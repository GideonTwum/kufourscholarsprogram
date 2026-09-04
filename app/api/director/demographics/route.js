import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import {
  applyDirectorOperationalScope,
  fetchAllApplicationPages,
} from "@/lib/director-application-scope";
import { aggregateDirectorDemographics } from "@/lib/director-demographics";

export const dynamic = "force-dynamic";

/**
 * GET /api/director/demographics
 * Aggregate-only demographics for operational (non-draft) applications.
 * Does not return applicant PII or row-level records.
 */
export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { data, error } = await fetchAllApplicationPages(() =>
    applyDirectorOperationalScope(
      admin.from("applications").select("gender, region, university")
    )
  );

  if (error) {
    console.error("[director/demographics] query failed", error.message || error);
    return NextResponse.json(
      { error: "Failed to load demographics analytics." },
      { status: 500 }
    );
  }

  const demographics = aggregateDirectorDemographics(data || []);
  return NextResponse.json(demographics);
}
