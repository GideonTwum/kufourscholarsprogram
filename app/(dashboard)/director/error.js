"use client";

export default function DirectorError({ error, reset }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-red-100 bg-red-50 p-8 text-center">
      <h2 className="text-lg font-semibold text-red-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-red-700">
        {error?.message || "The Director portal could not load this page."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90"
      >
        Try again
      </button>
    </div>
  );
}
