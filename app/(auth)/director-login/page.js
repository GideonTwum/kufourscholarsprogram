"use client";

import { useEffect, useState } from "react";
import PortalLoginForm from "@/components/auth/PortalLoginForm";

export default function DirectorLoginPage() {
  const [deactivatedHint, setDeactivatedHint] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("deactivated") === "1") {
      setDeactivatedHint(
        "This director account has been deactivated. Contact the foundation technical team if you need access restored."
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
        expectedRole="director"
        title="Director Sign In"
        subtitle="Access the director portal to manage applications and program operations"
        footer={
          <span className="text-xs text-gray-400">
            Director accounts are created by the foundation technical team. There is no public signup.
          </span>
        }
      />
    </>
  );
}
