"use client";

import { Building, BookOpen, GraduationCap, BarChart3, School } from "lucide-react";
import { GRADE_TYPES } from "@/lib/application-validation";

function gradePlaceholder(type) {
  switch (type) {
    case "CWA":
      return "e.g. 72.5 (Cumulative Weighted Average)";
    case "CGPA":
      return "e.g. 3.45 / 4.0";
    case "GPA":
      return "e.g. 3.85 / 4.0";
    default:
      return "Select grade type above, then enter your figure";
  }
}

const inputClass =
  "w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
const inputErrorClass =
  "w-full rounded-lg border border-red-300 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-200";

export default function AcademicInfo({ data, onChange, errors = {} }) {
  function update(field, value) {
    onChange((prev) => ({ ...prev, [field]: value }));
  }

  function fieldClass(field) {
    return errors[field] ? inputErrorClass : inputClass;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Academic Information</h2>
        <p className="mt-1 text-sm text-gray-500">
          Share your academic background. You must be <strong>currently enrolled</strong> at the institution below. Fields marked * are required.
        </p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Junior High School Attended</label>
        <div className="relative">
          <School size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.junior_high_school || ""} onChange={(e) => update("junior_high_school", e.target.value)} placeholder="e.g. Prempeh College JHS" className={fieldClass("junior_high_school")} />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Senior High School Attended</label>
        <div className="relative">
          <School size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.senior_high_school || ""} onChange={(e) => update("senior_high_school", e.target.value)} placeholder="e.g. Prempeh College" className={fieldClass("senior_high_school")} />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">University / Institution <span className="text-red-500">*</span></label>
        <div className="relative">
          <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.university || ""} onChange={(e) => update("university", e.target.value)} placeholder="e.g. University of Ghana" className={fieldClass("university")} />
        </div>
        {errors.university && <p className="mt-1 text-xs text-red-600">{errors.university}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Student ID Number</label>
        <div className="relative">
          <BookOpen size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.student_id || ""} onChange={(e) => update("student_id", e.target.value)} placeholder="e.g. 10234567" className={fieldClass("student_id")} />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Program / Course <span className="text-red-500">*</span></label>
        <div className="relative">
          <BookOpen size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.program || ""} onChange={(e) => update("program", e.target.value)} placeholder="e.g. BSc Computer Science" className={fieldClass("program")} />
        </div>
        {errors.program && <p className="mt-1 text-xs text-red-600">{errors.program}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Year of Study <span className="text-red-500">*</span></label>
        <div className="relative">
          <GraduationCap size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={data.year_of_study || ""} onChange={(e) => update("year_of_study", e.target.value)} className={fieldClass("year_of_study")}>
            <option value="">Select year</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
            <option value="Postgraduate">Postgraduate</option>
          </select>
        </div>
        {errors.year_of_study && <p className="mt-1 text-xs text-red-600">{errors.year_of_study}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Grade type <span className="text-red-500">*</span></label>
        <div className="relative">
          <BarChart3 size={18} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400" />
          <select
            value={data.grade_type || ""}
            onChange={(e) => update("grade_type", e.target.value)}
            className={`w-full appearance-none rounded-lg border py-2.5 pl-10 pr-4 text-sm outline-none ${errors.grade_type ? inputErrorClass : inputClass}`}
          >
            <option value="">Select CWA, CGPA, or GPA</option>
            {GRADE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
                {t === "CWA" ? " — Cumulative Weighted Average" : t === "CGPA" ? " — Cumulative GPA" : " — Grade Point Average"}
              </option>
            ))}
          </select>
        </div>
        {errors.grade_type && <p className="mt-1 text-xs text-red-600">{errors.grade_type}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Current {data.grade_type || "CWA / CGPA / GPA"} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <BarChart3 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={data.gpa || ""}
            onChange={(e) => update("gpa", e.target.value)}
            placeholder={gradePlaceholder(data.grade_type)}
            className={fieldClass("gpa")}
          />
        </div>
        {errors.gpa && <p className="mt-1 text-xs text-red-600">{errors.gpa}</p>}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={!!data.confirms_ghana_enrollment}
            onChange={(e) => update("confirms_ghana_enrollment", e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-royal focus:ring-gold"
          />
          <span className="text-sm text-gray-700">
            I confirm I am <strong>currently enrolled</strong> at the tertiary institution above, and it is{" "}
            <strong>located in Ghana</strong>. I understand that applications outside these criteria cannot be accepted.
          </span>
        </label>
        {errors.confirms_ghana_enrollment && (
          <p className="mt-2 text-xs text-red-600">{errors.confirms_ghana_enrollment}</p>
        )}
      </div>
    </div>
  );
}
