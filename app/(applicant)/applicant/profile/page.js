"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  User, Mail, Phone, Globe, Camera, Save, Loader2, CheckCircle2, PenLine, X,
} from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";

export default function ApplicantProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    async function load() {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: err } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (err) setError(err.message);
      if (data) { setProfile(data); setForm(data); }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("profiles").update({
      full_name: form.full_name, bio: form.bio, phone: form.phone, nationality: form.nationality, photo_url: form.photo_url,
    }).eq("id", profile.id);
    if (!err) { setProfile({ ...profile, ...form }); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError(err.message);
    setSaving(false);
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!/\.(jpg|jpeg|png)$/i.test(file.name)) {
      setUploadError("Please use JPG or PNG format.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image must be under 2MB.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;
    const { error: err } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (err) setUploadError(err.message || "Upload failed.");
    else {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((prev) => ({ ...prev, photo_url: publicUrl }));
    }
    setUploading(false);
  }

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 size={24} className="animate-spin text-royal" /></div>;
  }

  if (error && !profile) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6">
        <p className="font-semibold text-red-800">Unable to load profile</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <p className="mt-2 text-xs text-red-600">Try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your personal information.</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal-light"><PenLine size={14} />Edit Profile</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setForm(profile); setEditing(false); }} className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"><X size={14} />Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal-light disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save Changes
            </button>
          </div>
        )}
      </div>

      {saved && <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700"><CheckCircle2 size={16} />Profile updated successfully.</div>}
      {error && profile && <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      {uploadError && <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-700">{uploadError}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <div className="relative mx-auto h-28 w-28">
            {form.photo_url ? (
              <img src={form.photo_url} alt="Profile" className="h-28 w-28 rounded-full object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-royal text-3xl font-bold text-gold">
                {profile.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
              </div>
            )}
            {editing && (
              <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gold text-royal shadow-md hover:bg-gold-light">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                <input type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900">{profile.full_name}</h2>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-gray-900">Personal Information</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500"><User size={12} /> Full Name</label>
                {editing ? <input type="text" value={form.full_name || ""} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} className={inputClass} /> : <p className="text-sm text-gray-900">{profile.full_name || "\u2014"}</p>}
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500"><Mail size={12} /> Email</label>
                <p className="text-sm text-gray-900">{profile.email}</p>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500"><Phone size={12} /> Phone</label>
                {editing ? <input type="tel" value={form.phone || ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+233 XX XXX XXXX" className={inputClass} /> : <p className="text-sm text-gray-900">{profile.phone || "\u2014"}</p>}
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500"><Globe size={12} /> Nationality</label>
                {editing ? <input type="text" value={form.nationality || ""} onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))} placeholder="e.g. Ghanaian" className={inputClass} /> : <p className="text-sm text-gray-900">{profile.nationality || "\u2014"}</p>}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-gray-900">Bio</h3>
            {editing ? <textarea value={form.bio || ""} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} rows={4} placeholder="Tell us about yourself..." className={inputClass} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{profile.bio || "No bio yet."}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
