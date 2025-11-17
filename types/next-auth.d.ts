import "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    email: string
    name: string
    role: string
    roleCode: string
    accesoFinanzas: boolean
    campoId?: string
    campoNombre?: string // ✅ Nuevo
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      roleCode: string
      accesoFinanzas: boolean
      campoId?: string
      campoNombre?: string // ✅ Nuevo
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    roleCode: string
    accesoFinanzas: boolean
    campoId?: string
    campoNombre?: string // ✅ Nuevo
  }
}