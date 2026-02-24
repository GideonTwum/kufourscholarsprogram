"use client";

import { User, Calendar, Phone, MapPin, Globe } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
const inputErrorClass =
  "w-full rounded-lg border border-red-300 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-200";

export default function PersonalInfo({ data, onChange, errors = {} }) {
  function update(field, value) {
    onChange((prev) => ({ ...prev, [field]: value }));
  }

  function fieldClass(field) {
    return errors[field] ? inputErrorClass : inputClass;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
        <p className="mt-1 text-sm text-gray-500">Tell us a bit about yourself. All fields are required.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Full Name <span className="text-red-500">*</span></label>
        <div className="relative">
          <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.full_name || ""} onChange={(e) => update("full_name", e.target.value)} placeholder="Your full name" className={fieldClass("full_name")} />
        </div>
        {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Date of Birth <span className="text-red-500">*</span></label>
        <div className="relative">
          <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="date" value={data.date_of_birth || ""} onChange={(e) => update("date_of_birth", e.target.value)} className={fieldClass("date_of_birth")} />
        </div>
        {errors.date_of_birth && <p className="mt-1 text-xs text-red-600">{errors.date_of_birth}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
        <div className="relative">
          <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="tel" value={data.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="+233 XX XXX XXXX" className={fieldClass("phone")} />
        </div>
        {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Address <span className="text-red-500">*</span></label>
        <div className="relative">
          <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.address || ""} onChange={(e) => update("address", e.target.value)} placeholder="City, Region, Country" className={fieldClass("address")} />
        </div>
        {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Nationality <span className="text-red-500">*</span></label>
        <div className="relative">
          <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={data.nationality || ""} onChange={(e) => update("nationality", e.target.value)} placeholder="e.g. Ghanaian" className={fieldClass("nationality")} />
        </div>
        {errors.nationality && <p className="mt-1 text-xs text-red-600">{errors.nationality}</p>}
      </div>
    </div>
  );
}
