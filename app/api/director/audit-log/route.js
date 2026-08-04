import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";

export async function GET(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "";
  const entityType = searchParams.get("entity_type") || "";
  const actor = searchParams.get("actor") || "";
  const q = searchParams.get("q") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(10, Number(searchParams.get("pageSize") || 25)));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  let query = admin
    .from("director_audit_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (action) query = query.eq("action", action);
  if (entityType) query = query.eq("entity_type", entityType);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (actor) {
    query = query.or(
      `actor_email_snapshot.ilike.%${actor}%,actor_name_snapshot.ilike.%${actor}%`
    );
  }
  if (q) {
    query = query.or(`entity_id.ilike.%${q}%,actor_email_snapshot.ilike.%${q}%,action.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  }

  return NextResponse.json({
    events: data || [],
    page,
    pageSize,
    total: count || 0,
  });
}
