import { NextResponse } from "next/server";

export async function POST(request) {
  const { code } = await request.json();
  const valid = code === process.env.DIRECTOR_REGISTRATION_CODE;
  return NextResponse.json({ valid });
}
