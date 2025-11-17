import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },

      async authorize(credentials): Promise<any> {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        // Buscar usuario por email (findUnique falla si email es nullable)
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

        if (!user || !user.password) {
          return null;
        }

        // Comparar contraseña
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        // Devuelve datos que van al JWT
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          campoId: user.campoId,
        };
      },
    }),
  ],

  session: { strategy: "jwt" as const },

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // Guardar info del user en el JWT
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.campoId = user.campoId;
      }
      return token;
    },

    // Exponer la data del usuario en session.user
    async session({ session, token }: any) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            name: true,
            email: true,
            telefono: true,
            role: true,
            campoId: true,
          },
        });

        if (dbUser) {
          session.user = { ...session.user, ...dbUser };
        } else {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.campoId = token.campoId;
        }
      }

      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };