"use client";

import { User, GraduationCap, PenLine, FileText, CheckCircle2, XCircle, Edit, ExternalLink } from "lucide-react";

function Section({ title, icon: Icon, stepIndex, goToStep, readOnly, children }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Icon size={16} className="text-royal" />{title}</h3>
        {!readOnly && <button onClick={() => goToStep(stepIndex)} className="flex items-center gap-1 text-xs text-royal hover:text-gold"><Edit size={12} />Edit</button>}
      </div>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, href }) {
  const filled = !!value || !!href;
  return (
    <div className="flex items-start gap-2 text-sm">
      {filled ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-500" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-red-400" />}
      <div>
        <span className="text-gray-500">{label}:</span>{" "}
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-royal hover:text-gold">
            View document <ExternalLink size={10} />
          </a>
        ) : (
          <span className={filled ? "text-gray-900" : "text-red-400 italic"}>{value || "Not provided"}</span>
        )}
      </div>
    </div>
  );
}

export default function ReviewSubmit({ data, goToStep, readOnly, docUrls = {} }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Review Your Application</h2>
        <p className="mt-1 text-sm text-gray-500">Please review your information before submitting.</p>
      </div>
      <Section title="Personal Information" icon={User} stepIndex={0} goToStep={goToStep} readOnly={readOnly}>
        <Field label="Full Name" value={data.full_name} />
        <Field label="Date of Birth" value={data.date_of_birth} />
        <Field label="Phone" value={data.phone} />
        <Field label="Address" value={data.address} />
        <Field label="Nationality" value={data.nationality} />
      </Section>
      <Section title="Academic Information" icon={GraduationCap} stepIndex={1} goToStep={goToStep} readOnly={readOnly}>
        <Field label="University" value={data.university} />
        <Field label="Program" value={data.program} />
        <Field label="Year of Study" value={data.year_of_study} />
        <Field label="GPA" value={data.gpa} />
      </Section>
      <Section title="Essay & Video" icon={PenLine} stepIndex={2} goToStep={goToStep} readOnly={readOnly}>
        <Field label="Essay" value={data.essay ? `${data.essay.split(/\s+/).filter(Boolean).length} words` : ""} />
        <Field label="Video URL" value={data.video_url} />
      </Section>
      <Section title="Documents" icon={FileText} stepIndex={3} goToStep={goToStep} readOnly={readOnly}>
        <Field label="CV / Resume" value={data.cv_url ? "Uploaded" : ""} href={docUrls.cv_url} />
        <Field label="Recommendation Letter" value={data.recommendation_url ? "Uploaded" : ""} href={docUrls.recommendation_url} />
        <Field label="Passport Photo" value={data.photo_url ? "Uploaded" : ""} href={docUrls.photo_url} />
      </Section>
    </div>
  );
}
