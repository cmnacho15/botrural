// src/app/Providers.tsx
"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { ToastProvider } from "@/app/components/Toast"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <ToastProvider>
        {children}
      </ToastProvider>
    </SessionProvider>
  )
}