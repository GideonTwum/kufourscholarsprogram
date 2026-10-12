"use client";

import { useEffect, useState } from "react";
import { Camera, CheckCircle2, Loader2, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InstitutionSelect from "@/components/applicant/InstitutionSelect";
import { GENDER_OPTIONS, formatGenderLabel } from "@/lib/applicant-demographics";
import { buildApplicantProfilePatch } from "@/lib/applicant-profile";
import { passwordsMatch, PASSWORD_POLICY_MESSAGE, validatePasswordPolicy } from "@/lib/password-policy";

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

export default function ApplicantProfilePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState("");
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [email, setEmail] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/applicant/profile");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error || "Unable to load profile.");
    else {
      setData(json);
      setForm(draft(json));
      setEmail("");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSection(event, fields) {
    event.preventDefault();
    if (saving || !data?.application) return;
    setSaving(true);
    setError("");
    setNotice("");
    const body = { baseUpdatedAt: data.application.updated_at };
    for (const field of fields) body[field] = form[field];
    const correction = buildApplicantProfilePatch(body, data.application);
    if (!correction.ok) {
      setSaving(false);
      setError(correction.error);
      return;
    }
    const res = await fetch("/api/applicant/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Could not save.");
      return;
    }
    setNotice("Profile updated.");
    setSection("");
    await load();
  }

  async function saveBio(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/applicant/profile/bio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: form.bio || "", photo_url: form.photo_url || "" }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Could not save.");
      return;
    }
    setNotice("Profile updated.");
    setSection("");
    await load();
  }

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file || !data?.profile) return;
    if (!/\.(jpg|jpeg|png)$/i.test(file.name)) {
      setError("Please use JPG or PNG format.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    setError("");
    const ext = file.name.split(".").pop();
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setUploading(false);
      setError("You need to be signed in to upload a photo.");
      return;
    }
    const storagePath = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(storagePath, file, { upsert: true });
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message || "Upload failed.");
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(storagePath);
    setForm((prev) => ({ ...prev, photo_url: pub.publicUrl }));
  }

  async function saveEmail(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/applicant/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Could not start the email change.");
      return;
    }
    setNotice(json.message || "Verification email sent.");
    setSection("");
    await load();
  }

  async function savePassword(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    if (!passwordsMatch(password.newPassword, password.confirmPassword)) {
      setSaving(false);
      setError("New passwords do not match.");
      return;
    }
    const policy = validatePasswordPolicy(password.newPassword);
    if (!policy.ok) {
      setSaving(false);
      setError(policy.message);
      return;
    }
    const res = await fetch("/api/applicant/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Could not update password.");
      return;
    }
    setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setNotice(json.message || "Password updated.");
    setSection("");
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-royal" />
      </div>
    );
  }

  if (!data) {
    return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error || "Unable to load profile."}</p>;
  }

  const app = data.application;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Updates to your application details are shown to the Director and your assessor.
        </p>
      </div>
      {notice ? (
        <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> {notice}
        </p>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">Photo and bio</h2>
          {section === "bio" ? (
            <button type="button" onClick={() => { setForm(draft(data)); setSection(""); }} className="inline-flex items-center gap-1 text-xs text-gray-500"><X size={12} /> Cancel</button>
          ) : (
            <button type="button" onClick={() => { setForm(draft(data)); setSection("bio"); }} className="text-xs font-semibold text-royal">Edit</button>
          )}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0">
            {form.photo_url || data.profile.photo_url ? (
              <img src={section === "bio" ? form.photo_url : data.profile.photo_url} alt="Profile" className="h-28 w-28 rounded-full object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-royal text-3xl font-bold text-gold">
                {(data.profile.full_name || "?").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
            {section === "bio" ? (
              <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gold text-royal shadow-md">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                <input type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handlePhotoUpload} />
              </label>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            {section === "bio" ? (
              <form onSubmit={saveBio} className="space-y-3">
                <label className="block text-xs font-medium text-gray-600">Bio
                  <textarea className={`${inputClass} mt-1`} rows={4} value={form.bio || ""} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Tell us about yourself..." />
                </label>
                <SaveRow saving={saving || uploading} />
              </form>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{data.profile.bio || "No bio yet."}</p>
            )}
          </div>
        </div>
      </section>

      {!app ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Start an application before editing academic and personal application details.
        </p>
      ) : null}

      <Section
        title="Personal Information"
        editing={section === "personal"}
        onEdit={() => {
          setForm(draft(data));
          setSection("personal");
        }}
        onCancel={() => setSection("")}
      >
        {section === "personal" ? (
          <form onSubmit={(e) => saveSection(e, ["full_name", "date_of_birth", "gender", "hometown", "phone"])} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name"><input className={inputClass} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required /></Field>
            <Field label="Date of Birth"><input type="date" className={inputClass} value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} required /></Field>
            <Field label="Gender">
              <select className={inputClass} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} required>
                <option value="">Select</option>
                {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Hometown"><input className={inputClass} value={form.hometown} onChange={(e) => setForm((f) => ({ ...f, hometown: e.target.value }))} required /></Field>
            <Field label="Primary Phone Number"><input className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required /></Field>
            <Field label="Alternative Phone Number"><p className="text-sm text-gray-500">Not collected as a separate field.</p></Field>
            <SaveRow saving={saving} />
          </form>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Read label="Full Name" value={app?.full_name || data.profile.full_name} />
            <Read label="Date of Birth" value={app?.date_of_birth?.slice?.(0, 10)} />
            <Read label="Gender" value={formatGenderLabel(app?.gender)} />
            <Read label="Hometown" value={app?.hometown} />
            <Read label="Primary Phone Number" value={app?.phone || data.profile.phone} />
            <Read label="Alternative Phone Number" value="Not collected" />
          </dl>
        )}
      </Section>

      <Section
        title="Academic Information"
        editing={section === "academic"}
        onEdit={() => {
          setForm(draft(data));
          setSection("academic");
        }}
        onCancel={() => setSection("")}
      >
        {section === "academic" ? (
          <form onSubmit={(e) => saveSection(e, ["university", "program"])} className="space-y-4">
            <Field label="University / Institution"><InstitutionSelect value={form.university} onChange={(university) => setForm((f) => ({ ...f, university }))} /></Field>
            <Field label="Course / Programme of Study"><input className={inputClass} value={form.program} onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))} required /></Field>
            <SaveRow saving={saving} />
          </form>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Read label="University / Institution" value={app?.university} />
            <Read label="Course / Programme of Study" value={app?.program} />
          </dl>
        )}
      </Section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900">Account & Security</h2>
        <div className="mt-4 space-y-6">
          <div>
            <p className="text-xs font-medium text-gray-500">Email Address</p>
            <p className="mt-1 text-sm text-gray-900">{data.profile.email || "—"}</p>
            {data.pendingEmail ? (
              <p className="mt-1 text-xs font-medium text-amber-700">Pending verification: {data.pendingEmail}</p>
            ) : null}
            {section === "email" ? (
              <form onSubmit={saveEmail} className="mt-3 max-w-md space-y-3">
                <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="New email address" />
                <SaveRow saving={saving} onCancel={() => setSection("")} />
              </form>
            ) : (
              <button type="button" onClick={() => setSection("email")} className="mt-2 text-xs font-semibold text-royal">Change email</button>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Change Password</p>
            <p className="mt-1 text-xs text-gray-500">{PASSWORD_POLICY_MESSAGE}</p>
            {section === "password" ? (
              <form onSubmit={savePassword} className="mt-3 grid max-w-md gap-3">
                <input type="password" autoComplete="current-password" className={inputClass} placeholder="Current password" value={password.currentPassword} onChange={(e) => setPassword((p) => ({ ...p, currentPassword: e.target.value }))} required />
                <input type="password" autoComplete="new-password" className={inputClass} placeholder="New password" value={password.newPassword} onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))} required />
                <input type="password" autoComplete="new-password" className={inputClass} placeholder="Confirm new password" value={password.confirmPassword} onChange={(e) => setPassword((p) => ({ ...p, confirmPassword: e.target.value }))} required />
                <SaveRow saving={saving} onCancel={() => setSection("")} />
              </form>
            ) : (
              <button type="button" onClick={() => setSection("password")} className="mt-2 text-xs font-semibold text-royal">Change password</button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function draft(data) {
  const app = data?.application || {};
  return {
    full_name: app.full_name || data?.profile?.full_name || "",
    date_of_birth: app.date_of_birth ? String(app.date_of_birth).slice(0, 10) : "",
    gender: app.gender || "",
    hometown: app.hometown || "",
    phone: app.phone || data?.profile?.phone || "",
    university: app.university || "",
    program: app.program || "",
    bio: data?.profile?.bio || "",
    photo_url: data?.profile?.photo_url || "",
  };
}

function Section({ title, editing, onEdit, onCancel, children }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {editing ? (
          <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-xs text-gray-500"><X size={12} /> Cancel</button>
        ) : (
          <button type="button" onClick={onEdit} className="text-xs font-semibold text-royal">Edit</button>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return <label className="block text-xs font-medium text-gray-600">{label}<div className="mt-1">{children}</div></label>;
}

function Read({ label, value }) {
  return <div><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-0.5 text-gray-900">{value || "—"}</dd></div>;
}

function SaveRow({ saving, onCancel }) {
  return (
    <div className="flex gap-2 sm:col-span-2">
      {onCancel ? <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">Cancel</button> : null}
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
      </button>
    </div>
  );
}
