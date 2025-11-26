"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

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
  const { data: session, status } = useSession();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<string | null>(null);

  // ✅ Cerrar sidebar al hacer clic fuera (en móvil)
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  const campoNombre = session?.user?.campoNombre || "Mi Campo";

  const openModal = (tipo: string) => {
    setModalTipo(tipo);
    setMenuOpen(false);
  };

  const closeModal = () => setModalTipo(null);

  const userRole = session?.user?.role || "COLABORADOR";
  const accesoFinanzas = session?.user?.accesoFinanzas || false;
  const isContador = userRole === "CONTADOR";

  const allMenuSections = [
    {
      title: "Mi Campo",
      items: [
        { href: "/dashboard/empezar", icon: "🚀", label: "Cómo Empezar", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard", icon: "📊", label: "Resumen", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: false },
        { href: "/dashboard/datos", icon: "📝", label: "Datos", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/mapa", icon: "🗺️", label: "Mapa", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
      ],
    },
    {
      title: "Gestión",
      items: [
        { href: "/dashboard/lotes", icon: "🏞️", label: "Potreros", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/insumos", icon: "📦", label: "Insumos", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/mano-de-obra", icon: "👷", label: "Mano de Obra", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: false },
        { 
          href: "/dashboard/gastos", 
          icon: "💰", 
          label: "Gastos", 
          roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], 
          requiresFinance: true
        },
      ],
    },
    {
      title: "Configuración",
      items: [
        { href: "/dashboard/equipo", icon: "👥", label: "Equipo", roles: ["ADMIN_GENERAL"], requiresFinance: false },
        { href: "/dashboard/preferencias", icon: "⚙️", label: "Preferencias", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
      ],
    },
  ];

  const menuSections = allMenuSections
    .map(section => ({
      ...section,
      items: section.items.filter((item: any) => {
        if (item.requiresFinance) {
          if (userRole === "ADMIN_GENERAL" || userRole === "CONTADOR") {
            return true;
          }
          if (userRole === "COLABORADOR") {
            return accesoFinanzas;
          }
          return false;
        }
        return item.roles.includes(userRole);
      })
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-white border-b px-3 sm:px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 lg:hidden hover:bg-gray-100"
            aria-label="Abrir menú"
          >
            ☰
          </button>

          <Image 
  src="/BoTRURAL.svg"
  alt="BotRural"
  width={150}
  height={150}
  priority
/>
        </div>

        {!isContador && (
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="px-3 py-2 sm:px-4 text-sm sm:text-base bg-blue-500 text-white rounded-lg hover:bg-blue-600 whitespace-nowrap"
          >
            ＋ Nuevo Dato
          </button>
        )}
      </header>

      {/* MENÚ GIGANTE DE EVENTOS */}
      {menuOpen && !isContador && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-center items-start pt-4 sm:pt-10 p-3 sm:p-4 overflow-y-auto"
          onClick={() => setMenuOpen(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 max-w-5xl w-full relative my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 text-2xl sm:text-3xl leading-none"
            >
              ×
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 md:gap-8 mt-8 sm:mt-0">
              
              {/* ANIMALES */}
              <div>
                <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">ANIMALES</h3>
                <div className="space-y-1">
                  {[
                    ["cambio-potrero", "🔄", "Cambio De Potrero"],
                    ["tratamiento", "💉", "Tratamiento"],
                    ["venta", "💵", "Venta"],
                    ["compra", "🛒", "Compra"],
                    ["traslado", "🚚", "Traslado"],
                    ["nacimiento", "🐄", "Nacimiento"],
                    ["mortandad", "💀", "Mortandad"],
                    ["consumo", "🥩", "Consumo"],
                    ["aborto", "❌", "Aborto"],
                    ["destete", "🍼", "Destete"],
                    ["tacto", "✋", "Tacto"],
                    ["recategorizacion", "🏷️", "Recategorización"],
                  ].map(([tipo, emoji, label]) => (
                    <button
                      key={tipo}
                      onClick={() => openModal(tipo)}
                      className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <span className="text-sm sm:text-base">{emoji}</span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AGRICULTURA */}
              <div>
                <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">AGRICULTURA</h3>
                <div className="space-y-1">
                  {[
                    ["siembra", "🌱", "Siembra"],
                    ["pulverizacion", "💧", "Pulverización"],
                    ["refertilizacion", "🌿", "Refertilización"],
                    ["riego", "💦", "Riego"],
                    ["monitoreo", "🔍", "Monitoreo"],
                    ["cosecha", "🌾", "Cosecha"],
                    ["otros-labores", "🔧", "Otros Labores"],
                  ].map(([tipo, emoji, label]) => (
                    <button
                      key={tipo}
                      onClick={() => openModal(tipo)}
                      className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <span className="text-sm sm:text-base">{emoji}</span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CLIMA */}
              <div>
                <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">CLIMA</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => openModal("lluvia")} 
                    className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-sm sm:text-base">🌧️</span>
                    <span>Lluvia</span>
                  </button>
                  <button
                    onClick={() => openModal("helada")} 
                    className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-sm sm:text-base">❄️</span>
                    <span>Helada</span>
                  </button>
                </div>
              </div>

              {/* INSUMOS */}
              <div>
                <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">INSUMOS</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => openModal("uso-insumos")} 
                    className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-sm sm:text-base">📤</span>
                    <span>Uso</span>
                  </button>
                  <button
                    onClick={() => openModal("ingreso-insumos")} 
                    className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-sm sm:text-base">📥</span>
                    <span>Ingreso</span>
                  </button>
                </div>
              </div>

              {/* FINANZAS */}
              <div>
                <h3 className="font-bold mb-3 sm:mb-4 text-gray-800 text-xs sm:text-sm uppercase tracking-wide">FINANZAS</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => openModal("gasto")} 
                    className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-sm sm:text-base">💰</span>
                    <span>Gasto</span>
                  </button>
                  <button
                    onClick={() => openModal("ingreso")} 
                    className="w-full text-left flex items-center gap-2 text-xs sm:text-sm py-2 px-2 sm:px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-sm sm:text-base">✅</span>
                    <span>Ingreso</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY PARA CERRAR SIDEBAR EN MÓVIL */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`fixed lg:static inset-y-0 left-0 w-64 sm:w-72 lg:w-60 bg-white border-r transition-transform duration-300 z-30 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } overflow-y-auto`}
        >
          <nav className="p-3 sm:p-4 space-y-4 sm:space-y-6 pb-20 lg:pb-4">
            {menuSections.map((section, i) => (
              <div key={i}>
                <h3 className="text-xs text-gray-500 px-3 sm:px-4 mb-2 font-medium">
                  {section.title === "Mi Campo" ? campoNombre : section.title}
                </h3>

                {section.items.map((item: any) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-sm ${
                        isActive
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="text-base sm:text-lg">{item.icon}</span> 
                      <span className="text-sm sm:text-base">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">{children}</main>
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