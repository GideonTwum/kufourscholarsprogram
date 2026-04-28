import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { evaluateEligibilityForAutoReject } from "@/lib/eligibility-server";
import { sendTransactionalEmail, autoRejectEmailHtml } from "@/lib/email/notify";

function buildRow(body, userId, overrides = {}) {
  const leadership = Array.isArray(body.leadership_evidence_urls)
    ? body.leadership_evidence_urls.filter((x) => typeof x === "string" && x)
    : [];
  return {
    ...body,
    user_id: userId,
    leadership_evidence_urls: leadership,
    leadership_evidence_url: leadership[0] || null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { application_id, data: applicationData } = body;
  if (!applicationData) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const eligibility = evaluateEligibilityForAutoReject(applicationData);
  const submitted_at = new Date().toISOString();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error (missing service role)." },
      { status: 500 }
    );
  }

  let appId = application_id || null;

  if (appId) {
    const { data: existing } = await admin
      .from("applications")
      .select("id, user_id, status")
      .eq("id", appId)
      .single();
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "Application already submitted" }, { status: 400 });
    }
  }

  const userEmail = user.email || null;

  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const profileName = applicationData.full_name || prof?.full_name || "Applicant";

  if (!eligibility.ok) {
    const row = buildRow(applicationData, user.id, {
      status: "rejected",
      rejection_reason: eligibility.reason,
      submitted_at,
    });
    if (appId) {
      await admin.from("applications").update(row).eq("id", appId);
    } else {
      const { data: ins, error: insErr } = await admin.from("applications").insert(row).select("id").single();
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      appId = ins?.id;
    }
    if (userEmail) {
      await sendTransactionalEmail({
        to: userEmail,
        subject: "Kufuor Scholars Program — application update",
        html: autoRejectEmailHtml(profileName || "Applicant", eligibility.reason),
        text: `Your application could not proceed. ${eligibility.reason}`,
      });
    }
    return NextResponse.json({
      success: true,
      outcome: "rejected",
      rejection_reason: eligibility.reason,
      application_id: appId,
    });
  }

  const row = buildRow(applicationData, user.id, {
    status: "stage_1_submitted",
    rejection_reason: null,
    submitted_at,
    stage_1_submitted_at: submitted_at,
  });

  if (appId) {
    await admin.from("applications").update(row).eq("id", appId);
  } else {
    const { data: ins, error: insErr } = await admin.from("applications").insert(row).select("id").single();
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    appId = ins?.id;
  }

  if (userEmail) {
    await sendTransactionalEmail({
      to: userEmail,
      subject: "Kufuor Scholars — Stage 1 application received",
      html: `
        <p>Dear ${profileName || "Applicant"},</p>
        <p>Thank you for submitting your Stage 1 application. Your status is <strong>Pending</strong> while the selection committee reviews your file.</p>
        <p>We will notify you of the outcome.</p>
        <p>Best,<br/>The Kufuor Scholars Program Team</p>
      `,
      text: "Your Stage 1 application was received and is pending review.",
    });
  }

  return NextResponse.json({
    success: true,
    outcome: "pending",
    application_id: appId,
  });
}
