import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) return NextResponse.json({ error: "email requerido" });

  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      password: true,
      campoId: true,
    },
  });

  return NextResponse.json({ encontrado: !!user, user });
}