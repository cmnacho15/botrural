// src/app/api/auth/[...nextauth]/route.ts

import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },

      async authorize(credentials): Promise<any> {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email.toLowerCase().trim() },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            role: true,
            accesoFinanzas: true,
            campoId: true,
          },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          roleCode: user.role,
          accesoFinanzas: user.accesoFinanzas,
          campoId: user.campoId,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,

  // DEJAMOS LA PÁGINA PERSONALIZADA (porque queremos la bonita en español)
  pages: {
    signIn: "/login",
    signOut: "/auth/signout", // ← MANTENEMOS ESTA LÍNEA
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.roleCode = user.role;
        token.accesoFinanzas = user.accesoFinanzas;
        token.campoId = user.campoId;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            name: true,
            email: true,
            telefono: true,
            role: true,
            accesoFinanzas: true,
            campoId: true,
            campo: { select: { nombre: true } },
          },
        });

        if (dbUser) {
          session.user = {
            ...session.user,
            ...dbUser,
            roleCode: dbUser.role,
            campoNombre: dbUser.campo?.nombre || null,
          };
        } else {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.roleCode = token.roleCode;
          session.user.accesoFinanzas = token.accesoFinanzas;
          session.user.campoId = token.campoId;
          session.user.campoNombre = token.campoNombre || null;
        }
      }

      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };