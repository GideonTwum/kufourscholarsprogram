"use client";

import { useEffect, useState } from "react";
import PortalLoginForm from "@/components/auth/PortalLoginForm";

export default function PanelLoginPage() {
  const [deactivatedHint, setDeactivatedHint] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("deactivated") === "1") {
      setDeactivatedHint(
        "This account has been deactivated. Contact the program director if you need access restored."
      );
    }
  }, []);

  return (
    <>
      {deactivatedHint ? (
        <div className="mx-auto mb-4 max-w-md rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {deactivatedHint}
        </div>
      ) : null}
      <PortalLoginForm
        expectedRole="panel"
        title="Panel Sign In"
        subtitle="Sign in to evaluate interview applicants. Accounts are issued by the program director."
      />
    </>
  );
}
