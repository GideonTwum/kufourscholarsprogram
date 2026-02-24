"use client";

import { Building, BookOpen, GraduationCap, BarChart3 } from "lucide-react";

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
        <p className="mt-1 text-sm text-gray-500">Share your academic background. All fields are required.</p>
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
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Current GPA / Grade <span className="text-red-500">*</span></label>
        <div className="relative">
          <BarChart3 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.gpa || ""} onChange={(e) => update("gpa", e.target.value)} placeholder="e.g. 3.85 / 4.0 or First Class" className={fieldClass("gpa")} />
        </div>
        {errors.gpa && <p className="mt-1 text-xs text-red-600">{errors.gpa}</p>}
      </div>
    </div>
  );
}
