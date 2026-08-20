"use client";

import {
  User,
  GraduationCap,
  FileText,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Edit,
  ExternalLink,
  Share2,
} from "lucide-react";
import {
  CV_PERSONAL_STATEMENT_HINT,
  KSP_SOCIAL_HANDLES,
  getLeadershipEvidencePaths,
  getRecommendationLetterPaths,
} from "@/lib/application-validation";

function Section({ title, icon: Icon, stepIndex, goToStep, readOnly, children }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-gray-900">
          <Icon size={16} className="shrink-0 text-royal" />
          <span className="truncate">{title}</span>
        </h3>
        {!readOnly && goToStep ? (
          <button
            onClick={() => goToStep(stepIndex)}
            className="flex shrink-0 items-center gap-1 text-xs text-royal hover:text-gold"
          >
            <Edit size={12} />
            Edit
          </button>
        ) : null}
      </div>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, href, hrefLabel = "View document", optionalEmpty }) {
  const filled = !!value || !!href;
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      {filled ? (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-500" />
      ) : (
        <XCircle
          size={14}
          className={`mt-0.5 shrink-0 ${optionalEmpty ? "text-gray-300" : "text-red-400"}`}
        />
      )}
      <div className="min-w-0">
        <span className="text-gray-500">{label}:</span>{" "}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all text-royal hover:text-gold"
          >
            {hrefLabel} <ExternalLink size={10} />
          </a>
        ) : (
          <span
            className={`break-words ${
              filled ? "text-gray-900" : optionalEmpty ? "text-gray-400 italic" : "text-red-400 italic"
            }`}
          >
            {value || (optionalEmpty ? "Not provided (optional)" : "Not provided")}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ReviewSubmit({
  data,
  goToStep,
  readOnly,
  docUrls = {},
  title = "Review Your Application (Stage 1)",
  subtitle = "Please review your information before submitting.",
}) {
  const leadership = getLeadershipEvidencePaths(data);
  const recommendations = getRecommendationLetterPaths(data);
  const contact2 =
    data.emergency_contact_2_name || data.emergency_contact_2_number
      ? `${data.emergency_contact_2_name || ""} — ${data.emergency_contact_2_number || ""}`.trim()
      : "";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
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
        <Field
          label="Dual citizenship"
          value={
            data.has_dual_citizenship === true || data.has_dual_citizenship === "true"
              ? "Yes"
              : data.has_dual_citizenship === false || data.has_dual_citizenship === "false"
                ? "No"
                : ""
          }
        />
        {(data.has_dual_citizenship === true || data.has_dual_citizenship === "true") && (
          <Field label="Second Country of Citizenship" value={data.second_citizenship_country} />
        )}
        <Field
          label="Emergency contact 1"
          value={
            data.emergency_contact_name
              ? `${data.emergency_contact_name} — ${data.emergency_contact_number || ""}`
              : ""
          }
        />
        <Field label="Emergency contact 2" value={contact2} optionalEmpty />
        <Field label="LinkedIn" value={data.linkedin_url} />
        {data.instagram_url ? <Field label="Instagram" value={data.instagram_url} /> : null}
        {data.facebook_url ? <Field label="Facebook" value={data.facebook_url} /> : null}
        {data.tiktok_url ? <Field label="TikTok" value={data.tiktok_url} /> : null}
        {data.snapchat_url ? <Field label="Snapchat" value={data.snapchat_url} /> : null}
        {data.twitter_url ? <Field label="X (Twitter)" value={data.twitter_url} /> : null}
      </Section>
      <Section title="Academic Information" icon={GraduationCap} stepIndex={1} goToStep={goToStep} readOnly={readOnly}>
        <Field label="Junior High School" value={data.junior_high_school} />
        <Field label="Senior High School" value={data.senior_high_school} />
        <Field label="University" value={data.university} />
        <Field label="Student ID Number" value={data.student_id} optionalEmpty />
        <Field label="Program" value={data.program} />
        <Field label="Year of Study" value={data.year_of_study} />
        <Field label="Grade type" value={data.grade_type} />
        <Field label={`Current ${data.grade_type || "grade"}`} value={data.gpa} />
        <Field
          label="Enrolled in Ghana (confirmed)"
          value={data.confirms_ghana_enrollment ? "Yes — currently enrolled in Ghana" : ""}
        />
      </Section>
      <Section title="Documents" icon={FileText} stepIndex={2} goToStep={goToStep} readOnly={readOnly}>
        <Field
          label="Passport photograph (profile)"
          value={data.photo_url ? "Uploaded — used as your profile photo" : ""}
          href={docUrls.photo_url || (/^https?:\/\//i.test(data.photo_url || "") ? data.photo_url : undefined)}
        />
        <Field
          label="CV / Personal Statement"
          value={data.cv_personal_statement_url ? "Uploaded" : ""}
          href={docUrls.cv_personal_statement_url}
        />
        <p className="pl-5 text-xs text-gray-500">{CV_PERSONAL_STATEMENT_HINT}</p>
        <Field
          label="Academic Transcript"
          value={data.academic_transcript_url ? "Uploaded" : ""}
          href={docUrls.academic_transcript_url}
        />
        <Field
          label="Student ID"
          value={data.student_id_path ? "Uploaded" : ""}
          href={docUrls.student_id_path}
          hrefLabel="View Student ID"
        />
        {recommendations.length === 0 ? (
          <Field label="Recommendation Letters" value="" />
        ) : (
          recommendations.map((path, i) => (
            <Field
              key={`${path}-${i}`}
              label={`Recommendation Letter ${i + 1}`}
              value="Uploaded"
              href={docUrls.recommendations?.[i]}
            />
          ))
        )}
        {leadership.length === 0 ? (
          <Field label="Evidence of Leadership" value="" optionalEmpty />
        ) : (
          leadership.map((path, i) => (
            <Field
              key={`${path}-${i}`}
              label={`Leadership evidence ${i + 1}`}
              value="Uploaded"
              href={docUrls.leadership?.[i]}
            />
          ))
        )}
      </Section>
      <Section title="KSP Social Media Evidence" icon={Share2} stepIndex={2} goToStep={goToStep} readOnly={readOnly}>
        <Field
          label={`TikTok (${KSP_SOCIAL_HANDLES.tiktok})`}
          value={data.ksp_tiktok_follow_screenshot_path ? "Screenshot uploaded" : ""}
          href={docUrls.ksp_tiktok_follow_screenshot_path}
          hrefLabel="View TikTok screenshot"
        />
        <Field
          label={`LinkedIn (${KSP_SOCIAL_HANDLES.linkedin})`}
          value={data.ksp_linkedin_follow_screenshot_path ? "Screenshot uploaded" : ""}
          href={docUrls.ksp_linkedin_follow_screenshot_path}
          hrefLabel="View LinkedIn screenshot"
        />
        <Field
          label={`Instagram (${KSP_SOCIAL_HANDLES.instagram})`}
          value={data.ksp_instagram_follow_screenshot_path ? "Screenshot uploaded" : ""}
          href={docUrls.ksp_instagram_follow_screenshot_path}
          hrefLabel="View Instagram screenshot"
        />
        <p className="pl-5 text-xs text-gray-500">
          Screenshot evidence confirms an upload was provided; the system does not independently
          verify social accounts.
        </p>
      </Section>
      <Section title="Concept Note" icon={Lightbulb} stepIndex={3} goToStep={goToStep} readOnly={readOnly}>
        <Field label="Title" value={data.concept_note_title} />
        <Field
          label="Document"
          value={data.concept_note_path ? "Uploaded" : ""}
          href={docUrls.concept_note_path}
          hrefLabel="View Concept Note"
        />
      </Section>
    </div>
  );
}
