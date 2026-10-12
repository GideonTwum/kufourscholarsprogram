import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { isApplicantRole } from "@/lib/portal-auth";
import {
  APPLICANT_PROFILE_UPDATED_ACTION,
  buildApplicantProfilePatch,
  profileUpdateConflicts,
} from "@/lib/applicant-profile";
import { syncVerifiedApplicantEmail } from "@/lib/applicant-email-sync";
import { commitApplicantProfileAtomically } from "@/lib/applicant-profile-commit";

const APP_FIELDS =
  "id, user_id, status, updated_at, full_name, date_of_birth, gender, hometown, phone, university, program";

async function requireApplicant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, phone, bio, photo_url, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isApplicantRole(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, profile, supabase };
}

export async function GET() {
  const gate = await requireApplicant();
  if (gate.error) return gate.error;

  const admin = createAdminClient();
  const { data: applications } = await admin
    .from("applications")
    .select(APP_FIELDS)
    .eq("user_id", gate.user.id)
    .order("updated_at", { ascending: false });

  const latest = applications?.[0] || null;
  const pendingEmail = gate.user.new_email || gate.user.email_change || null;
  const synced = await syncVerifiedApplicantEmail(admin, gate.user, {
    profileEmail: gate.profile.email,
    fullName: gate.profile.full_name,
    applicationId: latest?.id || null,
  });
  const email = synced.email || gate.profile.email || null;

  return NextResponse.json({
    profile: {
      full_name: latest?.full_name || gate.profile.full_name || "",
      email,
      phone: latest?.phone || gate.profile.phone || "",
      bio: gate.profile.bio || "",
      photo_url: gate.profile.photo_url || "",
    },
    application: latest,
    applicationCount: applications?.length || 0,
    pendingEmail,
    alternativePhoneSupported: false,
  });
}

export async function PATCH(request) {
  const gate = await requireApplicant();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: applications, error: loadError } = await admin
    .from("applications")
    .select(APP_FIELDS)
    .eq("user_id", gate.user.id)
    .order("updated_at", { ascending: false });

  if (loadError) {
    return NextResponse.json({ error: "Could not load your application." }, { status: 500 });
  }

  const latest = applications?.[0] || null;
  const academic = ["university", "program", "date_of_birth", "gender", "hometown"].some(
    (field) => Object.prototype.hasOwnProperty.call(body, field)
  );
  if (!latest && academic) {
    return NextResponse.json(
      { error: "No application record is available to update." },
      { status: 409 }
    );
  }

  if (latest && profileUpdateConflicts(latest.updated_at, body.baseUpdatedAt)) {
    return NextResponse.json(
      { error: "These details were updated elsewhere. Refresh and try again." },
      { status: 409 }
    );
  }

  const correction = buildApplicantProfilePatch(body, latest || gate.profile);
  if (!correction.ok) {
    return NextResponse.json({ error: correction.error }, { status: correction.status });
  }

  const atomic = await commitApplicantProfileAtomically(admin, {
    userId: gate.user.id,
    patch: correction.patch,
    baseUpdatedAt: latest?.updated_at || null,
    actorName: correction.patch.full_name || gate.profile.full_name,
    actorEmail: gate.profile.email,
    oldValue: correction.oldValue,
    newValue: correction.newValue,
  });
  if (atomic.available) {
    if (atomic.conflict) {
      return NextResponse.json(
        { error: "These details were updated elsewhere. Refresh and try again." },
        { status: 409 }
      );
    }
    if (!atomic.ok) {
      return NextResponse.json({ error: atomic.error || "Could not save your profile." }, { status: 500 });
    }
    return NextResponse.json({ success: true, changed: Object.keys(correction.newValue) });
  }

  const previousRows = (applications || []).map((row) => ({ ...row }));
  const previousProfile = {
    full_name: gate.profile.full_name,
    phone: gate.profile.phone,
  };
  const writePatch = { ...correction.patch, updated_at: new Date().toISOString() };

  async function rollbackApplications() {
    for (const prev of previousRows) {
      await admin
        .from("applications")
        .update(identitySnapshot(prev))
        .eq("id", prev.id)
        .eq("user_id", gate.user.id);
    }
  }

  if (latest) {
    for (const row of applications) {
      const { error } = await admin
        .from("applications")
        .update(writePatch)
        .eq("id", row.id)
        .eq("user_id", gate.user.id);
      if (error) {
        await rollbackApplications();
        return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
      }
    }
  }

  const profilePatch = {};
  if (correction.patch.full_name) profilePatch.full_name = correction.patch.full_name;
  if (correction.patch.phone) profilePatch.phone = correction.patch.phone;
  let profileWritten = false;
  if (Object.keys(profilePatch).length > 0) {
    const { error } = await admin.from("profiles").update(profilePatch).eq("id", gate.user.id);
    if (error) {
      await rollbackApplications();
      return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
    }
    profileWritten = true;
  }

  const audit = await recordDirectorAudit({
    actor: { id: gate.user.id, full_name: correction.patch.full_name || gate.profile.full_name, email: gate.profile.email },
    action: APPLICANT_PROFILE_UPDATED_ACTION,
    entityType: "application",
    entityId: latest?.id || gate.user.id,
    oldValue: correction.oldValue,
    newValue: correction.newValue,
    metadata: {
      actor_type: "applicant",
      application_ids: (applications || []).map((row) => row.id),
    },
    request,
    critical: true,
  });

  if (!audit.ok) {
    await rollbackApplications();
    if (profileWritten) {
      await admin.from("profiles").update(previousProfile).eq("id", gate.user.id);
    }
    return NextResponse.json(
      { error: "The change could not be recorded and was not saved." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, changed: Object.keys(correction.newValue) });
}

function identitySnapshot(row) {
  return {
    full_name: row.full_name,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    hometown: row.hometown,
    phone: row.phone,
    university: row.university,
    program: row.program,
  };
}
