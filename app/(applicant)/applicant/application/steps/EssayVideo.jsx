"use client";

import { PenLine, Video } from "lucide-react";
import { MIN_ESSAY_WORDS } from "@/lib/application-validation";

const inputClass =
  "w-full rounded-lg border border-gray-200 p-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
const inputErrorClass =
  "w-full rounded-lg border border-red-300 p-4 text-sm text-gray-900 outline-none transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-200";

export default function EssayVideo({ data, onChange, errors = {} }) {
  function update(field, value) {
    onChange((prev) => ({ ...prev, [field]: value }));
  }

  const wordCount = (data.essay || "").split(/\s+/).filter(Boolean).length;
  const essayValid = wordCount >= MIN_ESSAY_WORDS;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Essay & Video Introduction</h2>
        <p className="mt-1 text-sm text-gray-500">Express who you are and what drives you.</p>
      </div>
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <PenLine size={16} /> Personal Statement / Essay <span className="text-red-500">*</span>
        </label>
        <textarea
          value={data.essay || ""}
          onChange={(e) => update("essay", e.target.value)}
          rows={10}
          placeholder="Tell us about yourself, your goals, and why you'd like to join the Kufuor Scholars Program. What impact do you want to make in Africa? (minimum 300 words)"
          className={errors.essay ? inputErrorClass : inputClass}
        />
        <p className={`mt-1 text-xs ${essayValid ? "text-gray-400" : "text-red-600"}`}>
          {wordCount} / {MIN_ESSAY_WORDS} words minimum
        </p>
        {errors.essay && <p className="mt-1 text-xs text-red-600">{errors.essay}</p>}
      </div>
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Video size={16} /> Video Introduction (YouTube Link) <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={data.video_url || ""}
          onChange={(e) => update("video_url", e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className={`w-full rounded-lg border p-3 text-sm text-gray-900 outline-none transition-colors focus:ring-2 ${errors.video_url ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-200 focus:border-gold focus:ring-gold/20"}`}
        />
        <p className="mt-1 text-xs text-gray-400">Upload a 4-minute self-introduction video to YouTube (unlisted is fine) and paste the link above.</p>
        {errors.video_url && <p className="mt-1 text-xs text-red-600">{errors.video_url}</p>}
      </div>
    </div>
  );
}
