import { redirect } from "next/navigation";

/** Alias for documentation consistency — canonical detail route remains /assessor/[id]. */
export default async function AssessorApplicationAliasPage({ params }) {
  const { id } = await params;
  redirect(`/assessor/${id}`);
}
