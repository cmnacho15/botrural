"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DatosProvider } from "@/app/contexts/DatosContext";
import { InsumosProvider } from "@/app/contexts/InsumosContext";
import { GastosProvider } from "@/app/contexts/GastosContext";
import ModalNuevoDato from "@/app/components/modales/ModalNuevoDato";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DatosProvider>
      <InsumosProvider>
        <GastosProvider>
          <LayoutContent>{children}</LayoutContent>
        </GastosProvider>
      </InsumosProvider>
    </DatosProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nuevoDatoMenuOpen, setNuevoDatoMenuOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<string | null>(null);

  // 🔹 Menú estático (los permisos por rol los manejás dentro de cada página si querés)
  const menuSections = [
    {
      title: "Mi Campo",
      items: [
        { href: "/dashboard/empezar", icon: "🚀", label: "Cómo Empezar" },
        { href: "/dashboard", icon: "📊", label: "Resumen" },
        { href: "/dashboard/datos", icon: "📝", label: "Datos" },
        { href: "/dashboard/mapa", icon: "🗺️", label: "Mapa" },
      ],
    },
    {
      title: "Gestión",
      items: [
        { href: "/dashboard/lotes", icon: "🏞️", label: "Potreros" },
        { href: "/dashboard/insumos", icon: "📦", label: "Insumos" },
        { href: "/dashboard/mano-de-obra", icon: "👷", label: "Mano de Obra" },
        { href: "/dashboard/gastos", icon: "💰", label: "Gastos" },
      ],
    },
    {
      title: "Configuración",
      items: [
        { href: "/dashboard/equipo", icon: "👥", label: "Equipo" },
        { href: "/dashboard/preferencias", icon: "⚙️", label: "Preferencias" },
      ],
    },
  ];

  const openModal = (tipo: string) => {
    setModalTipo(tipo);
    setNuevoDatoMenuOpen(false);
  };

  const closeModal = () => {
    setModalTipo(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 lg:hidden hover:bg-gray-100"
          >
            ☰
          </button>

          <span className="text-xl font-bold text-gray-900">BotRural</span>
        </div>

        {/* Botón + menú de "Nuevo Dato" */}
        <div className="relative">
          <button
            onClick={() => setNuevoDatoMenuOpen((prev) => !prev)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            ＋ Nuevo Dato
          </button>

          {nuevoDatoMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border rounded-lg shadow-lg z-50">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b">
                Registrar evento
              </div>

              <button
                onClick={() => openModal("lluvia")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                🌧️ Lluvia
              </button>
              <button
                onClick={() => openModal("helada")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                ❄️ Helada
              </button>
              <button
                onClick={() => openModal("gasto")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                💰 Gasto
              </button>
              <button
                onClick={() => openModal("ingreso")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                ✅ Ingreso
              </button>
              <button
                onClick={() => openModal("uso-insumos")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                🧪 Uso de insumos
              </button>
              <button
                onClick={() => openModal("ingreso-insumos")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                📦 Ingreso de insumos
              </button>
              <button
                onClick={() => openModal("siembra")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                🌱 Siembra
              </button>
              <button
                onClick={() => openModal("cambio-potrero")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                🔁 Cambio de potrero
              </button>
              <button
                onClick={() => openModal("nacimiento")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                🐑 Nacimiento
              </button>
              <button
                onClick={() => openModal("recategorizacion")}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                🏷️ Recategorización
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 w-60 bg-white border-r transition-transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <nav className="p-4 space-y-6">
            {menuSections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-xs text-gray-500 px-4 mb-2">{section.title}</h3>
                {section.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                        isActive
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span>{item.icon}</span> {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {/* MODAL NUEVO DATO */}
      {modalTipo && (
        <ModalNuevoDato
          isOpen={true}
          tipo={modalTipo}
          onClose={closeModal}
          onSuccess={() => {
            // acá podés refrescar datos si querés
            closeModal();
          }}
        />
      )}
    </div>
  );
}