import { redirect } from "next/navigation";

/** Canonical UI is /director/email-tests */
export default function EmailTestRedirect() {
  redirect("/director/email-tests");
}
