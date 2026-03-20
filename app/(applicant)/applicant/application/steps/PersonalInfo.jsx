"use client";

import { User, Calendar, Phone, MapPin, Globe, Heart, Share2 } from "lucide-react";
import { MAX_APPLICANT_AGE } from "@/lib/application-validation";

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
        <p className="mt-1 text-sm text-gray-500">Tell us about yourself. All fields marked with * are required.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
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
          <p className="mt-1 text-xs text-gray-500">
            You must be {MAX_APPLICANT_AGE} or under when you apply.
          </p>
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
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Address <span className="text-red-500">*</span></label>
          <div className="relative">
            <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={data.address || ""} onChange={(e) => update("address", e.target.value)} placeholder="City, Region, Country" className={fieldClass("address")} />
          </div>
          {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Hometown</label>
          <input type="text" value={data.hometown || ""} onChange={(e) => update("hometown", e.target.value)} placeholder="e.g. Kumasi" className={fieldClass("hometown")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Region</label>
          <input type="text" value={data.region || ""} onChange={(e) => update("region", e.target.value)} placeholder="e.g. Ashanti Region" className={fieldClass("region")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Country of Origin <span className="text-red-500">*</span></label>
          <div className="relative">
            <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={data.country_of_origin || data.nationality || ""} onChange={(e) => update("country_of_origin", e.target.value)} placeholder="e.g. Nigeria, Kenya" className={fieldClass("country_of_origin")} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            African nationality required — not limited to Ghana.
          </p>
          {errors.country_of_origin && <p className="mt-1 text-xs text-red-600">{errors.country_of_origin}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nationality <span className="text-red-500">*</span></label>
          <div className="relative">
            <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={data.nationality || ""} onChange={(e) => update("nationality", e.target.value)} placeholder="e.g. Nigerian, Ghanaian" className={fieldClass("nationality")} />
          </div>
          {errors.nationality && <p className="mt-1 text-xs text-red-600">{errors.nationality}</p>}
        </div>
        <div className="sm:col-span-2 space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Heart size={16} /> Emergency contact 1 <span className="text-red-500">*</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <input
                  type="text"
                  value={data.emergency_contact_name || ""}
                  onChange={(e) => update("emergency_contact_name", e.target.value)}
                  placeholder="Full name"
                  className={fieldClass("emergency_contact_name")}
                />
                {errors.emergency_contact_name && (
                  <p className="mt-1 text-xs text-red-600">{errors.emergency_contact_name}</p>
                )}
              </div>
              <div>
                <input
                  type="tel"
                  value={data.emergency_contact_number || ""}
                  onChange={(e) => update("emergency_contact_number", e.target.value)}
                  placeholder="Phone number"
                  className={fieldClass("emergency_contact_number")}
                />
                {errors.emergency_contact_number && (
                  <p className="mt-1 text-xs text-red-600">{errors.emergency_contact_number}</p>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Heart size={16} /> Emergency contact 2 <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-gray-500">Provide a second person we can reach if the first contact is unavailable.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <input
                  type="text"
                  value={data.emergency_contact_2_name || ""}
                  onChange={(e) => update("emergency_contact_2_name", e.target.value)}
                  placeholder="Full name"
                  className={fieldClass("emergency_contact_2_name")}
                />
                {errors.emergency_contact_2_name && (
                  <p className="mt-1 text-xs text-red-600">{errors.emergency_contact_2_name}</p>
                )}
              </div>
              <div>
                <input
                  type="tel"
                  value={data.emergency_contact_2_number || ""}
                  onChange={(e) => update("emergency_contact_2_number", e.target.value)}
                  placeholder="Phone number"
                  className={fieldClass("emergency_contact_2_number")}
                />
                {errors.emergency_contact_2_number && (
                  <p className="mt-1 text-xs text-red-600">{errors.emergency_contact_2_number}</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="sm:col-span-2 space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Share2 size={16} /> LinkedIn <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-gray-500">Your public LinkedIn profile is required. Other platforms below are optional.</p>
            <input
              type="url"
              value={data.linkedin_url || ""}
              onChange={(e) => update("linkedin_url", e.target.value)}
              placeholder="https://www.linkedin.com/in/your-profile"
              className={`w-full rounded-lg border py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20 ${errors.linkedin_url ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-200"}`}
            />
            {errors.linkedin_url && <p className="mt-1 text-xs text-red-600">{errors.linkedin_url}</p>}
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Share2 size={16} /> Other social profiles <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input type="url" value={data.instagram_url || ""} onChange={(e) => update("instagram_url", e.target.value)} placeholder="Instagram URL" className={fieldClass("instagram_url")} />
              <input type="url" value={data.facebook_url || ""} onChange={(e) => update("facebook_url", e.target.value)} placeholder="Facebook URL" className={fieldClass("facebook_url")} />
              <input type="url" value={data.tiktok_url || ""} onChange={(e) => update("tiktok_url", e.target.value)} placeholder="TikTok URL" className={fieldClass("tiktok_url")} />
              <input type="url" value={data.snapchat_url || ""} onChange={(e) => update("snapchat_url", e.target.value)} placeholder="Snapchat URL" className={fieldClass("snapchat_url")} />
              <input type="url" value={data.twitter_url || ""} onChange={(e) => update("twitter_url", e.target.value)} placeholder="X (Twitter) URL" className={fieldClass("twitter_url")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
