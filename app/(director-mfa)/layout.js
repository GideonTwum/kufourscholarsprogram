import Link from "next/link";

/**
 * CURRENTLY UNUSED shell — MFA enrollment/challenge are not in the active
 * Director auth flow. Pages under this layout only redirect away.
 */
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
    </div>
  );
}
