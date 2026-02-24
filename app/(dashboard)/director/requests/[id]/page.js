"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Send,
  User,
} from "lucide-react";

const statusOptions = [
  { value: "open", label: "Open", color: "bg-blue-100 text-blue-700" },
  {
    value: "in_progress",
    label: "In Progress",
    color: "bg-amber-100 text-amber-700",
  },
  {
    value: "resolved",
    label: "Resolved",
    color: "bg-green-100 text-green-700",
  },
  { value: "closed", label: "Closed", color: "bg-gray-100 text-gray-600" },
];

export default function DirectorRequestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [request, setRequest] = useState(null);
  const [scholar, setScholar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: req } = await supabase
        .from("requests")
        .select("*")
        .eq("id", id)
        .single();

      if (req) {
        setRequest(req);
        setResponse(req.director_response || "");
        setStatus(req.status);

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, class_name")
          .eq("id", req.user_id)
          .single();

        setScholar(profile);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("requests")
      .update({
        status,
        director_response: response,
        responded_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (!error) {
      setRequest((prev) => ({
        ...prev,
        status,
        director_response: response,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center">
        <p className="text-gray-500">Request not found.</p>
        <Link href="/director/requests" className="mt-2 text-sm text-royal">
          Back to Requests
        </Link>
      </div>
    );
  }

  const currentStatus = statusOptions.find((s) => s.value === request.status);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/director/requests"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-royal"
      >
        <ArrowLeft size={14} />
        Back to Requests
      </Link>

      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
          <CheckCircle2 size={16} />
          Response saved successfully.
        </div>
      )}

      {/* Request details */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {request.subject}
            </h1>
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User size={12} />
                {scholar?.full_name || "Unknown"}
              </span>
              <span>{scholar?.class_name || "No class"}</span>
              <span>{new Date(request.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${currentStatus?.color || ""}`}
          >
            {currentStatus?.label || request.status}
          </span>
        </div>

        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {request.body}
          </p>
        </div>
      </div>

      {/* Director response */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-gray-900">Your Response</h3>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Update Status
          </label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  status === opt.value
                    ? "bg-royal text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Response to Scholar
          </label>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={4}
            placeholder="Write your response here... This will be visible to the scholar."
            className="w-full rounded-lg border border-gray-200 p-4 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal-light disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Save Response
          </button>
        </div>
      </div>
    </div>
  );
}
