"use client"

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react"
import { createPortal } from "react-dom"

type ToastType = "success" | "error" | "info"

interface ToastItem {
  id: number
  message: string
  type: ToastType
  exiting: boolean
}

let globalAddToast: ((message: string, type: ToastType) => void) | null = null
let toastId = 0

export const toast = {
  success: (message: string) => {
    if (globalAddToast) globalAddToast(message, "success")
  },
  error: (message: string) => {
    if (globalAddToast) globalAddToast(message, "error")
  },
  info: (message: string) => {
    if (globalAddToast) globalAddToast(message, "info")
  },
}

const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "#f0fdf4", border: "#86efac", text: "#166534", icon: "✓" },
  error: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "✕" },
  info: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", icon: "ℹ" },
}

function ToastMessage({ item, onRemove }: { item: ToastItem; onRemove: (id: number) => void }) {
  const c = colors[item.type]

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: "8px",
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: "14px",
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        animation: item.exiting ? "toast-out 0.3s ease-in forwards" : "toast-in 0.3s ease-out",
        cursor: "pointer",
        maxWidth: "400px",
        wordBreak: "break-word" as const,
      }}
      onClick={() => onRemove(item.id)}
    >
      <span style={{ fontSize: "16px", flexShrink: 0 }}>{c.icon}</span>
      <span>{item.message}</span>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 300)
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType) => {
      const id = ++toastId
      setToasts((prev) => [...prev, { id, message, type, exiting: false }])
      const duration = type === "error" ? 4000 : 3000
      setTimeout(() => removeToast(id), duration)
    },
    [removeToast]
  )

  useEffect(() => {
    globalAddToast = addToast
    return () => {
      globalAddToast = null
    }
  }, [addToast])

  return (
    <>
      {children}
      {mounted &&
        createPortal(
          <>
            <style>{`
              @keyframes toast-in {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes toast-out {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(12px); }
              }
            `}</style>
            <div
              style={{
                position: "fixed",
                bottom: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                alignItems: "center",
              }}
              className="toast-container"
            >
              {toasts.map((t) => (
                <ToastMessage key={t.id} item={t} onRemove={removeToast} />
              ))}
            </div>
            <style>{`
              @media (min-width: 768px) {
                .toast-container {
                  bottom: auto !important;
                  top: 20px !important;
                  left: auto !important;
                  right: 20px !important;
                  transform: none !important;
                  align-items: flex-end !important;
                }
              }
            `}</style>
          </>,
          document.body
        )}
    </>
  )
}
