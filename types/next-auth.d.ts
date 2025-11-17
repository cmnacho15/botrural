import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;            // 👈 agregado
    accesoFinanzas?: boolean; // 👈 agregado
    campoId?: string;         // 👈 agregado
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;            // 👈 agregado
      accesoFinanzas?: boolean; // 👈 agregado
      campoId?: string;         // 👈 agregado
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;              // 👈 agregado
    accesoFinanzas?: boolean;  // 👈 agregado
    campoId?: string;          // 👈 agregado
  }
}