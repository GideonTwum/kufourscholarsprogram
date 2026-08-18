"use client";

import { Check, X } from "lucide-react";
import {
  PASSWORD_REQUIREMENT_LABELS,
  getPasswordPolicyChecks,
  passwordStrengthLabel,
} from "@/lib/password-policy";

const ORDER = [
  "minLength",
  "uppercase",
  "lowercase",
  "number",
  "specialCharacter",
];

/**
 * Live password requirements checklist.
 * Announce a compact summary via aria-live — not every row on each keystroke.
 *
 * @param {{ password: string, showWhenEmpty?: boolean, id?: string }} props
 */
export default function PasswordPolicyChecklist({
  password,
  showWhenEmpty = false,
  id = "password-requirements",
}) {
  const value = typeof password === "string" ? password : "";
  if (!value && !showWhenEmpty) return null;

  const checks = getPasswordPolicyChecks(value);
  const strength = value ? passwordStrengthLabel(checks) : null;
  const summary = value
    ? checks.valid
      ? "Password meets all security requirements. Strength: Strong."
      : `${checks.metCount} of 5 password requirements met. Strength: ${strength}.`
    : "Enter a password to see requirements.";

  return (
    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={id} className="text-xs font-medium text-gray-700">
          Password requirements
        </p>
        {strength ? (
          <p
            className={`text-xs font-semibold ${
              strength === "Strong"
                ? "text-green-700"
                : strength === "Fair"
                  ? "text-amber-700"
                  : "text-red-600"
            }`}
          >
            Strength: {strength}
          </p>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {summary}
      </p>

      <ul className="mt-2 space-y-1.5" aria-labelledby={id}>
        {ORDER.map((key) => {
          const met = checks[key];
          const label = PASSWORD_REQUIREMENT_LABELS[key];
          return (
            <li
              key={key}
              className={`flex items-start gap-2 text-xs sm:text-sm ${
                met ? "text-green-700" : value ? "text-red-600" : "text-gray-500"
              }`}
            >
              <span className="mt-0.5 shrink-0" aria-hidden="true">
                {met ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
              </span>
              <span>
                <span className="sr-only">{met ? "Met: " : "Not met: "}</span>
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
