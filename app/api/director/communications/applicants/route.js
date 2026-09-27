import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveDirector } from "@/lib/director-auth";
import {
  lookupCommunicationApplicantById,
  searchCommunicationApplicants,
} from "@/lib/director-communications";

/**
 * GET — Director-only applicant search / lookup for Individual communications.
 *
 * Query:
 *   ?q=...              search by name / email / institution (min 2 chars)
 *   ?application_id=... preselect / resolve one operational application
 *
 * Returns only approved selector fields. Never trusts client email for auth.
 */
export async function GET(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("application_id")?.trim() || "";
  const q = searchParams.get("q")?.trim() || "";

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  if (applicationId) {
    const result = await lookupCommunicationApplicantById(admin, applicationId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Applicant not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, applicant: result.applicant });
  }

  if (!q) {
    return NextResponse.json({
      ok: true,
      applicants: [],
      message: "Type a name or email to search.",
    });
  }

  const result = await searchCommunicationApplicants(admin, q);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Search failed." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    applicants: result.applicants,
    message: result.message,
  });
}
