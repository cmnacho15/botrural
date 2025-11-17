"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<string | null>(null);

  const openModal = (tipo: string) => {
    setModalTipo(tipo);
    setMenuOpen(false);
  };

  const closeModal = () => setModalTipo(null);

  // MENÚ LATERAL
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 lg:hidden hover:bg-gray-100"
          >
            ☰
          </button>

          <span className="text-xl font-bold text-gray-900">BotRural</span>
        </div>

        {/* BOTÓN NUEVO DATO */}
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          ＋ Nuevo Dato
        </button>
      </header>

      {/* MENÚ GIGANTE DE EVENTOS - 5 COLUMNAS */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex justify-center items-start pt-10 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-5xl w-full">
            
            {/* Botón cerrar */}
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
              
              {/* ANIMALES */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-700 text-sm uppercase tracking-wide">Animales</h3>
                {[
                  ["cambio-potrero", "Cambio De Potrero"],
                  ["tratamiento", "Tratamiento"],
                  ["venta", "Venta"],
                  ["compra", "Compra"],
                  ["traslado", "Traslado"],
                  ["nacimiento", "Nacimiento"],
                  ["mortandad", "Mortandad"],
                  ["consumo", "Consumo"],
                  ["aborto", "Aborto"],
                  ["destete", "Destete"],
                  ["tacto", "Tacto"],
                  ["recategorizacion", "Recategorización"],
                ].map(([tipo, label]) => (
                  <p
                    key={tipo}
                    onClick={() => openModal(tipo)}
                    className="cursor-pointer text-sm py-1.5 px-2 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    {label}
                  </p>
                ))}
              </div>

              {/* AGRICULTURA */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-700 text-sm uppercase tracking-wide">Agricultura</h3>
                {[
                  ["siembra", "Siembra"],
                  ["pulverizacion", "Pulverización"],
                  ["refertilizacion", "Refertilización"],
                  ["riego", "Riego"],
                  ["monitoreo", "Monitoreo"],
                  ["cosecha", "Cosecha"],
                  ["otros-labores", "Otros Labores"],
                ].map(([tipo, label]) => (
                  <p
                    key={tipo}
                    onClick={() => openModal(tipo)}
                    className="cursor-pointer text-sm py-1.5 px-2 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    {label}
                  </p>
                ))}
              </div>

              {/* CLIMA */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-700 text-sm uppercase tracking-wide">Clima</h3>
                <p 
                  onClick={() => openModal("lluvia")} 
                  className="cursor-pointer text-sm py-1.5 px-2 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Lluvia
                </p>
                <p 
                  onClick={() => openModal("helada")} 
                  className="cursor-pointer text-sm py-1.5 px-2 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Helada
                </p>
              </div>

              {/* INSUMOS */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-700 text-sm uppercase tracking-wide">Insumos</h3>
                <p 
                  onClick={() => openModal("uso-insumos")} 
                  className="cursor-pointer text-sm py-1.5 px-2 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Uso
                </p>
                <p 
                  onClick={() => openModal("ingreso-insumos")} 
                  className="cursor-pointer text-sm py-1.5 px-2 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Ingreso
                </p>
              </div>

              {/* FINANZAS */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-700 text-sm uppercase tracking-wide">Finanzas</h3>
                <p 
                  onClick={() => openModal("gasto")} 
                  className="cursor-pointer text-sm py-1.5 px-2 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Gasto
                </p>
                <p 
                  onClick={() => openModal("ingreso")} 
                  className="cursor-pointer text-sm py-1.5 px-2 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Ingreso
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`fixed lg:static inset-y-0 left-0 w-60 bg-white border-r transition-transform z-30 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <nav className="p-4 space-y-6">
            {menuSections.map((section, i) => (
              <div key={i}>
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

      {/* MODAL DEL EVENTO ELEGIDO */}
      {modalTipo && (
        <ModalNuevoDato
          isOpen={true}
          tipo={modalTipo}
          onClose={closeModal}
          onSuccess={closeModal}
        />
      )}
    </div>
  );
}