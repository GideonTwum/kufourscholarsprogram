/** Application statuses visible to the panel interview dashboard. */
export const PANEL_INTERVIEW_STATUSES = ["called_for_interview", "interview"];

export function getApplicantDisplayName(app) {
  return app?.profiles?.full_name || app?.full_name || "Unknown Applicant";
}

export function getApplicantDisplayEmail(app) {
  const email = app?.profiles?.email || app?.email;
  return email?.trim() ? email : "No email available";
}

export function getApplicantInitials(app) {
  const name = getApplicantDisplayName(app);
  if (name === "Unknown Applicant") return "?";
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}
