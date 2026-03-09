"use client";

import { User, GraduationCap, FileText, CheckCircle2, XCircle, Edit, ExternalLink } from "lucide-react";

function Section({ title, icon: Icon, stepIndex, goToStep, readOnly, children }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Icon size={16} className="text-royal" />{title}</h3>
        {!readOnly && goToStep && <button onClick={() => goToStep(stepIndex)} className="flex items-center gap-1 text-xs text-royal hover:text-gold"><Edit size={12} />Edit</button>}
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
        <h2 className="text-lg font-bold text-gray-900">Review Your Application (Stage 1)</h2>
        <p className="mt-1 text-sm text-gray-500">Please review your information before submitting.</p>
      </div>
      <Section title="Personal Information" icon={User} stepIndex={0} goToStep={goToStep} readOnly={readOnly}>
        <Field label="Full Name" value={data.full_name} />
        <Field label="Date of Birth" value={data.date_of_birth} />
        <Field label="Phone" value={data.phone} />
        <Field label="Address" value={data.address} />
        <Field label="Hometown" value={data.hometown} />
        <Field label="Region" value={data.region} />
        <Field label="Country of Origin" value={data.country_of_origin} />
        <Field label="Nationality" value={data.nationality} />
        <Field label="Emergency Contact" value={data.emergency_contact_name ? `${data.emergency_contact_name} - ${data.emergency_contact_number}` : ""} />
        <Field label="Social Media" value={[data.linkedin_url, data.instagram_url, data.facebook_url, data.tiktok_url, data.snapchat_url, data.twitter_url].filter(Boolean).length ? "Provided" : ""} />
      </Section>
      <Section title="Academic Information" icon={GraduationCap} stepIndex={1} goToStep={goToStep} readOnly={readOnly}>
        <Field label="Junior High School" value={data.junior_high_school} />
        <Field label="Senior High School" value={data.senior_high_school} />
        <Field label="University" value={data.university} />
        <Field label="Student ID" value={data.student_id} />
        <Field label="Program" value={data.program} />
        <Field label="Year of Study" value={data.year_of_study} />
        <Field label="GPA" value={data.gpa} />
      </Section>
      <Section title="Documents" icon={FileText} stepIndex={2} goToStep={goToStep} readOnly={readOnly}>
        <Field label="CV / Personal Statement" value={data.cv_personal_statement_url ? "Uploaded" : ""} href={docUrls.cv_personal_statement_url} />
        <Field label="Academic Transcript" value={data.academic_transcript_url ? "Uploaded" : ""} href={docUrls.academic_transcript_url} />
        <Field label="Evidence of Leadership" value={data.leadership_evidence_url ? "Uploaded" : ""} href={docUrls.leadership_evidence_url} />
        <Field label="Recommendation Letter" value={data.recommendation_url ? "Uploaded" : ""} href={docUrls.recommendation_url} />
      </Section>
    </div>
  );
}
