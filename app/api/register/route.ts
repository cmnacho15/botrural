import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// 📩 POST /api/register
export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // 🔍 Validaciones básicas
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Nombre, email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // 📧 Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "El formato de email no es válido" },
        { status: 400 }
      );
    }

    // 🔒 Validar longitud de contraseña
    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // ⚠️ Verificar si ya existe el usuario
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 409 }
      );
    }

    // 🔐 Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 👤 Crear usuario con rol ADMIN (primer usuario del campo)
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: "ADMIN", // ✅ primer registro siempre será ADMIN
        campoId: null, // todavía no tiene un campo asignado
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    console.log("✅ Nuevo usuario admin registrado:", user);

    return NextResponse.json(
      { success: true, message: "Usuario registrado correctamente", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("💥 Error al registrar usuario:", error);
    return NextResponse.json(
      { error: "Error interno al registrar usuario" },
      { status: 500 }
    );
  }
}