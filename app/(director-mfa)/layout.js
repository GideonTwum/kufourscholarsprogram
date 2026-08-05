import Link from "next/link";

/** Minimal shell for Director MFA enroll/challenge (no dashboard nav). */
export default function DirectorMfaLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-royal-dark via-royal to-royal-light px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold text-xl font-bold text-royal">
          KS
        </div>
        <span className="text-xl font-bold text-white">Kufuor Scholars</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-center text-xs text-white/40">
        Director multi-factor authentication is required for portal access.
      </p>
    </div>
  );
}
