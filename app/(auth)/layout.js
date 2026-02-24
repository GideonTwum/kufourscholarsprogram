import Link from "next/link";

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-royal-dark via-royal to-royal-light px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold text-royal font-bold text-xl">
          KS
        </div>
        <span className="text-xl font-bold text-white">Kufuor Scholars</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-center text-xs text-white/40">
        &copy; 2026 John Agyekum Kufuor Foundation. All rights reserved.
      </p>
    </div>
  );
}
