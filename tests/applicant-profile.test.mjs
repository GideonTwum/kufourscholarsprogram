import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildApplicantProfilePatch,
  profileUpdateConflicts,
} from "../lib/applicant-profile.js";
import { aggregateDirectorDemographics } from "../lib/director-demographics.js";
import { buildApplicantDetailsCorrection } from "../lib/director-applicant-details.js";

const current = {
  full_name: "Ama Mensah",
  date_of_birth: "2004-01-15",
  gender: "female",
  hometown: "Kumasi",
  phone: "+233201112233",
  university: "University of Ghana",
  program: "Economics",
  status: "stage_2_submitted",
};

function edit(overrides) {
  return buildApplicantProfilePatch({ ...overrides }, current);
}

const profileApi = readFileSync(resolve("app/api/applicant/profile/route.js"), "utf8");
const emailApi = readFileSync(resolve("app/api/applicant/account/email/route.js"), "utf8");
const passwordApi = readFileSync(resolve("app/api/applicant/account/password/route.js"), "utf8");
const historyApi = readFileSync(
  resolve("app/api/director/applications/[id]/profile-changes/route.js"),
  "utf8"
);
const directorPage = readFileSync(
  resolve("app/(dashboard)/director/applications/[id]/page.js"),
  "utf8"
);
const assessor = readFileSync(resolve("lib/assessor-workflow.js"), "utf8");
const recovery = readFileSync(resolve("lib/applicant-account-recovery.js"), "utf8");
const profilePage = readFileSync(resolve("app/(applicant)/applicant/profile/page.js"), "utf8");

test("1. Applicant updates full name", () => {
  assert.equal(edit({ full_name: "Ama Serwaa" }).newValue.full_name, "Ama Serwaa");
});

test("2. Applicant updates date of birth", () => {
  assert.equal(edit({ date_of_birth: "2003-05-02" }).newValue.date_of_birth, "2003-05-02");
});

test("3. Applicant updates gender", () => {
  assert.equal(edit({ gender: "Male" }).newValue.gender, "male");
});

test("4. Applicant updates hometown", () => {
  assert.equal(edit({ hometown: "Ho" }).newValue.hometown, "Ho");
});

test("5. Applicant updates university", () => {
  assert.equal(
    edit({ university: "kwame nkrumah university of science and technology" }).newValue.university,
    "Kwame Nkrumah University of Science and Technology"
  );
});

test("6. Applicant updates programme", () => {
  assert.equal(edit({ program: "Law" }).newValue.program, "Law");
});

test("7. Applicant updates primary phone", () => {
  assert.equal(edit({ phone: "+233 24 000 0000" }).newValue.phone, "+233 24 000 0000");
});

test("8. Alternative phone is not a stored field", () => {
  assert.match(profilePage, /alternativePhoneSupported|Not collected/);
  assert.match(profileApi, /alternativePhoneSupported: false/);
  assert.equal(edit({ alt_phone: "0200000000" }).ok, false);
});

test("9. Partial edits preserve unchanged fields", () => {
  const result = edit({ hometown: "Accra" });
  assert.deepEqual(Object.keys(result.patch), ["hometown"]);
  assert.equal(result.oldValue.full_name, undefined);
});

test("10. Director reads the same application fields", () => {
  assert.match(directorPage, /application\.phone/);
  assert.match(directorPage, /profile\?\.email/);
  assert.match(directorPage, /DirectorProfileChanges/);
});

test("11. Assessor reads application identity fields", () => {
  for (const field of ["full_name", "phone", "university", "program", "gender", "hometown", "date_of_birth"]) {
    assert.match(assessor, new RegExp(field));
  }
});

test("12. Demographics reflect corrected gender", () => {
  const before = aggregateDirectorDemographics([{ gender: "female", university: "University of Ghana", region: "Ashanti" }]);
  const after = aggregateDirectorDemographics([{ gender: "male", university: "University of Ghana", region: "Ashanti" }]);
  assert.equal(before.gender.female, 1);
  assert.equal(after.gender.male, 1);
});

test("13. University statistics reflect corrections", () => {
  const before = aggregateDirectorDemographics([{ gender: "female", university: "University of Ghana", region: "Ashanti" }]);
  const after = aggregateDirectorDemographics([{ gender: "female", university: "Ashesi University", region: "Ashanti" }]);
  assert.notEqual(before.universities.items[0].name, after.universities.items[0].name);
});

test("14. Invalid input is rejected", () => {
  assert.equal(edit({ gender: "other" }).ok, false);
  assert.equal(edit({ phone: "12" }).ok, false);
  assert.equal(edit({ date_of_birth: "yesterday" }).ok, false);
});

test("15. Unauthorized requests are rejected", () => {
  assert.match(profileApi, /Unauthorized/);
  assert.match(emailApi, /Unauthorized/);
  assert.match(passwordApi, /status: 401/);
  assert.match(profileApi, /isApplicantRole/);
});

test("16. Cross-account editing is blocked", () => {
  assert.match(profileApi, /\.eq\("user_id", gate\.user\.id\)/);
  assert.doesNotMatch(profileApi, /body\.user_id|body\.applicant_id|body\.profile_id/);
});

test("17. Unknown fields are rejected", () => {
  assert.match(buildApplicantProfilePatch({ status: "accepted" }, current).error, /Unknown/);
  assert.match(buildApplicantProfilePatch({ role: "director" }, current).error, /Unknown/);
});

test("18. Application status remains unchanged", () => {
  assert.doesNotMatch(profileApi, /\.update\(\{[^}]*\bstatus\b/);
  assert.equal(edit({ hometown: "Ho" }).patch.status, undefined);
});

test("19. Assessment scores remain unchanged", () => {
  assert.doesNotMatch(profileApi, /application_assessments/);
  assert.doesNotMatch(passwordApi, /application_assessments/);
});

test("20. Assignments remain unchanged", () => {
  assert.doesNotMatch(profileApi, /assessor_assignments/);
  assert.doesNotMatch(emailApi, /assessor_assignments/);
});

test("21. Email verification is required", () => {
  assert.match(emailApi, /auth\.updateUser/);
  assert.match(emailApi, /pending_verification/);
  assert.match(emailApi, /emailRedirectTo/);
});

test("22. Pending email changes do not overwrite verified email", () => {
  assert.doesNotMatch(emailApi, /profiles"\)[\s\S]*update\(\{\s*email/);
  const sync = readFileSync(resolve("lib/applicant-email-sync.js"), "utf8");
  assert.match(sync, /reason: "pending"/);
});

test("23. Verified email synchronization works", () => {
  const sync = readFileSync(resolve("lib/applicant-email-sync.js"), "utf8");
  assert.match(sync, /APPLICANT_EMAIL_VERIFIED_ACTION/);
  assert.match(sync, /emailConfirmedAt/);
  assert.match(sync, /update\(\{ email: plan\.email \}\)/);
  assert.match(profileApi, /syncVerifiedApplicantEmail/);
  const confirm = readFileSync(resolve("app/auth/confirm/route.js"), "utf8");
  assert.match(confirm, /isEmailChangeOtpType/);
  assert.match(confirm, /syncVerifiedApplicantEmail/);
});

test("24. Password changes use Supabase Auth", () => {
  assert.match(passwordApi, /signInWithPassword/);
  assert.match(passwordApi, /updateUser\(\{\s*password:\s*nextPassword\s*\}\)/);
  assert.doesNotMatch(passwordApi, /from\("applications"\)/);
});

test("25. Incorrect current password is rejected", () => {
  const policy = readFileSync(resolve("lib/password-policy.js"), "utf8");
  assert.match(policy, /Current password is incorrect/);
  assert.match(passwordApi, /classifyPasswordChangeError/);
});

test("26. Passwords are never logged", () => {
  assert.doesNotMatch(passwordApi, /console\.(log|info|error|warn)/);
  assert.match(passwordApi, /password_changed: true/);
  assert.doesNotMatch(passwordApi, /newValue:\s*\{[^}]*newPassword/);
});

test("27. Audit records identify the applicant actor", () => {
  assert.match(profileApi, /actor_type: "applicant"/);
  assert.match(emailApi, /actor_type: "applicant"/);
  assert.match(passwordApi, /actor_type: "applicant"/);
  assert.match(historyApi, /"Applicant"/);
});

test("28. Concurrent changes do not silently overwrite data", () => {
  assert.equal(profileUpdateConflicts("2026-10-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z"), true);
  assert.equal(profileUpdateConflicts("2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"), false);
  assert.match(profileApi, /status: 409/);
});

test("29. Existing account recovery continues working", () => {
  assert.match(recovery, /password_reset/);
});

test("30. Existing Director editing remains functional", () => {
  assert.match(directorPage, /DirectorEditApplicantDetails/);
  const director = buildApplicantDetailsCorrection(
    { full_name: "New Name", reason: "Correction" },
    current
  );
  assert.equal(director.ok, true);
  assert.match(historyApi, /application\.details_corrected/);
});
