"use client";

import Link from "next/link";
import PortalLoginForm from "@/components/auth/PortalLoginForm";

export default function LoginPage() {
  return (
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
  );
}
