import { redirect } from "next/navigation";

/** Public director signup disabled — use developer staff script. */
export default function DirectorSignupDisabledPage() {
  redirect("/director-login");
}
