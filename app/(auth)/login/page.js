"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import PortalLoginForm from "@/components/auth/PortalLoginForm";

function VerifiedBanner() {
  const searchParams = useSearchParams();
  // Display-only — never treat ?verified=true as authentication proof.
  if (searchParams.get("verified") !== "true") return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
      <span>
        Email verified successfully. You can now sign in to continue your application.
      </span>
    </div>
  );
}

function LoginContent() {
  return (
    <>
      <VerifiedBanner />
      <PortalLoginForm
        expectedRole="applicant"
        title="Applicant Sign In"
        subtitle="Sign in to continue your application and scholar portal"
        footer={
          <>
            New to the program?{" "}
            <Link href="/applicant-register" className="font-semibold text-gold-dark hover:text-gold">
              Create an account
            </Link>
          </>
        }
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <PortalLoginForm
          expectedRole="applicant"
          title="Applicant Sign In"
          subtitle="Sign in to continue your application and scholar portal"
        />
      }
    >
      <LoginContent />
    </Suspense>
  );
}
