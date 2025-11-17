import "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    email: string
    name: string
    role: string
    roleCode?: string        // 👈 FALTABA ESTO
    accesoFinanzas?: boolean
    campoId?: string
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      roleCode?: string      // 👈 FALTABA ESTO
      accesoFinanzas?: boolean
      campoId?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    roleCode?: string        // 👈 FALTABA ESTO
    accesoFinanzas?: boolean
    campoId?: string
  }
}