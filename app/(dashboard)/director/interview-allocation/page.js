import { redirect } from "next/navigation";

export default async function DirectorInterviewAllocationRedirect({ searchParams }) {
  const params = await searchParams;
  const next = new URLSearchParams();
  next.set("tab", "batches");
  for (const key of ["region", "loc", "q"]) {
    const value = params?.[key];
    if (typeof value === "string" && value.trim()) next.set(key, value.trim());
  }
  redirect(`/director/interviews?${next.toString()}`);
}
