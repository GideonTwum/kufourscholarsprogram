"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, UserCircle, Plus, Loader2, Trash2, Edit, Camera } from "lucide-react";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function DirectorTeamsPage() {
  const supabase = createClient();
  const [teams, setTeams] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("teams");
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showMentorForm, setShowMentorForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMentor, setEditingMentor] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: "", slug: "", description: "", display_order: 0 });
  const [mentorForm, setMentorForm] = useState({
    full_name: "",
    slug: "",
    title: "",
    bio: "",
    linkedin_url: "",
    expertise: "",
    team_id: "",
    display_order: 0,
    photo_url: "",
  });
  const [mentorPhotoFile, setMentorPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: teamsData } = await supabase.from("teams").select("*").order("display_order", { ascending: true });
    const { data: mentorsData } = await supabase.from("mentors").select("*, teams(name)").order("display_order", { ascending: true });
    setTeams(teamsData || []);
    setMentors(mentorsData || []);
    setLoading(false);
  }

  function openTeamForm(team = null) {
    setEditingTeam(team?.id || null);
    setTeamForm({
      name: team?.name || "",
      slug: team?.slug || "",
      description: team?.description || "",
      display_order: team?.display_order ?? 0,
    });
    setShowTeamForm(true);
  }

  function openMentorForm(mentor = null) {
    setEditingMentor(mentor?.id || null);
    setMentorForm({
      full_name: mentor?.full_name || "",
      slug: mentor?.slug || "",
      title: mentor?.title || "",
      bio: mentor?.bio || "",
      linkedin_url: mentor?.linkedin_url || "",
      expertise: mentor?.expertise || "",
      team_id: mentor?.team_id || "",
      display_order: mentor?.display_order ?? 0,
      photo_url: mentor?.photo_url || "",
    });
    setMentorPhotoFile(null);
    setShowMentorForm(true);
  }

  function updateTeamSlug() {
    if (teamForm.name && !teamForm.slug) setTeamForm((f) => ({ ...f, slug: slugify(f.name) }));
  }

  function updateMentorSlug() {
    if (mentorForm.full_name && !mentorForm.slug) setMentorForm((f) => ({ ...f, slug: slugify(f.full_name) }));
  }

  async function handleTeamSubmit(e) {
    e.preventDefault();
    const payload = { ...teamForm, updated_at: new Date().toISOString() };
    if (editingTeam) {
      await supabase.from("teams").update(payload).eq("id", editingTeam);
    } else {
      await supabase.from("teams").insert(payload);
    }
    setShowTeamForm(false);
    load();
  }

  async function handleMentorSubmit(e) {
    e.preventDefault();
    setUploadingPhoto(true);
    let photoUrl = mentorForm.photo_url?.trim() || null;

    if (mentorPhotoFile) {
      const ext = mentorPhotoFile.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
      const path = `${editingMentor || crypto.randomUUID()}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("mentors").upload(path, mentorPhotoFile, {
        upsert: true,
        contentType: mentorPhotoFile.type || undefined,
      });
      if (upErr) {
        alert(`Photo upload failed: ${upErr.message}. Run the mentors storage migration if you haven’t.`);
        setUploadingPhoto(false);
        return;
      }
      const { data: pub } = supabase.storage.from("mentors").getPublicUrl(path);
      photoUrl = pub.publicUrl;
    }

    const payload = {
      ...mentorForm,
      photo_url: photoUrl,
      team_id: mentorForm.team_id || null,
      updated_at: new Date().toISOString(),
    };

    if (editingMentor) {
      await supabase.from("mentors").update(payload).eq("id", editingMentor);
    } else {
      await supabase.from("mentors").insert(payload);
    }
    setUploadingPhoto(false);
    setMentorPhotoFile(null);
    setShowMentorForm(false);
    load();
  }

  async function handleTeamDelete(id) {
    if (!confirm("Delete this team?")) return;
    await supabase.from("teams").delete().eq("id", id);
    load();
  }

  async function handleMentorDelete(id) {
    if (!confirm("Delete this mentor?")) return;
    await supabase.from("mentors").delete().eq("id", id);
    load();
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Teams & Mentors</h1>
        <p className="mt-1 text-sm text-gray-500">Manage teams and mentors for the public website.</p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("teams")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "teams" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Teams ({teams.length})
        </button>
        <button
          onClick={() => setActiveTab("mentors")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "mentors" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Mentors ({mentors.length})
        </button>
      </div>

      {/* Teams tab */}
      {activeTab === "teams" && (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => openTeamForm()}
              className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90"
            >
              <Plus size={16} /> Add Team
            </button>
          </div>
          {showTeamForm && (
            <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-bold text-gray-900">{editingTeam ? "Edit Team" : "Add Team"}</h2>
              <form onSubmit={handleTeamSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Name *</label>
                  <input
                    type="text"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
                    onBlur={updateTeamSlug}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Slug *</label>
                  <input
                    type="text"
                    value={teamForm.slug}
                    onChange={(e) => setTeamForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="leadership-team"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
                  <textarea
                    value={teamForm.description}
                    onChange={(e) => setTeamForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Display Order</label>
                  <input
                    type="number"
                    value={teamForm.display_order}
                    onChange={(e) => setTeamForm((f) => ({ ...f, display_order: +e.target.value || 0 }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90">
                    {editingTeam ? "Update" : "Add"} Team
                  </button>
                  <button type="button" onClick={() => setShowTeamForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          <div className="space-y-3">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-royal/10 text-royal">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{team.name}</p>
                    {team.description && <p className="text-sm text-gray-500 line-clamp-1">{team.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openTeamForm(team)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-royal">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleTeamDelete(team.id)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mentors tab */}
      {activeTab === "mentors" && (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => openMentorForm()}
              className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90"
            >
              <Plus size={16} /> Add Mentor
            </button>
          </div>
          {showMentorForm && (
            <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-bold text-gray-900">{editingMentor ? "Edit Mentor" : "Add Mentor"}</h2>
              <form onSubmit={handleMentorSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Full Name *</label>
                    <input
                      type="text"
                      value={mentorForm.full_name}
                      onChange={(e) => setMentorForm((f) => ({ ...f, full_name: e.target.value }))}
                      onBlur={updateMentorSlug}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Slug *</label>
                    <input
                      type="text"
                      value={mentorForm.slug}
                      onChange={(e) => setMentorForm((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="jane-doe"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Title</label>
                  <input
                    type="text"
                    value={mentorForm.title}
                    onChange={(e) => setMentorForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Former Ambassador, CEO"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Team</label>
                  <select
                    value={mentorForm.team_id}
                    onChange={(e) => setMentorForm((f) => ({ ...f, team_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  >
                    <option value="">— None (standalone mentor) —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Expertise</label>
                  <input
                    type="text"
                    value={mentorForm.expertise}
                    onChange={(e) => setMentorForm((f) => ({ ...f, expertise: e.target.value }))}
                    placeholder="e.g. Public Policy, Leadership"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Photo</label>
                  <p className="mb-2 text-xs text-gray-400">
                    Upload a square headshot (JPG or PNG, under 2MB recommended). Or paste an image URL below.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    {(mentorForm.photo_url || mentorPhotoFile) && (
                      <div className="h-20 w-20 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mentorPhotoFile ? URL.createObjectURL(mentorPhotoFile) : mentorForm.photo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-royal hover:text-royal">
                      <Camera size={16} />
                      {mentorPhotoFile ? "Replace photo" : "Choose photo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          setMentorPhotoFile(f || null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Photo URL (optional)</label>
                  <input
                    type="url"
                    value={mentorForm.photo_url}
                    onChange={(e) => setMentorForm((f) => ({ ...f, photo_url: e.target.value }))}
                    placeholder="https://… if the image is hosted elsewhere"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">LinkedIn URL</label>
                  <input
                    type="url"
                    value={mentorForm.linkedin_url}
                    onChange={(e) => setMentorForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Bio</label>
                  <textarea
                    value={mentorForm.bio}
                    onChange={(e) => setMentorForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Display Order</label>
                  <input
                    type="number"
                    value={mentorForm.display_order}
                    onChange={(e) => setMentorForm((f) => ({ ...f, display_order: +e.target.value || 0 }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={uploadingPhoto}
                    className="flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50"
                  >
                    {uploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : null}
                    {editingMentor ? "Update" : "Add"} Mentor
                  </button>
                  <button type="button" onClick={() => setShowMentorForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          <div className="space-y-3">
            {mentors.map((mentor) => (
              <div key={mentor.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  {mentor.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mentor.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
                      <UserCircle size={20} />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{mentor.full_name}</p>
                    <p className="text-sm text-gray-500">{mentor.title || mentor.teams?.name || "—"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openMentorForm(mentor)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-royal">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleMentorDelete(mentor.id)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
