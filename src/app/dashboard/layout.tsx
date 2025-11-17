"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";


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
  const { data: session } = useSession();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<string | null>(null);
  const [campoNombre, setCampoNombre] = useState("Mi Campo"); // ✅ Nuevo

  // ✅ Cargar nombre del campo
  useEffect(() => {
    const fetchCampoNombre = async () => {
      try {
        const res = await fetch("/api/usuarios/campos");
        const data = await res.json();
        if (data.campoNombre) {
          setCampoNombre(data.campoNombre);
        }
      } catch (error) {
        console.error("Error cargando nombre del campo:", error);
      }
    };

    if (session?.user?.id) {
      fetchCampoNombre();
    }
  }, [session]);

  const openModal = (tipo: string) => {
    setModalTipo(tipo);
    setMenuOpen(false);
  };

  const closeModal = () => setModalTipo(null);

  // Obtener rol y permisos del usuario
  const userRole = session?.user?.role || "COLABORADOR";
  const accesoFinanzas = session?.user?.accesoFinanzas || false;
  const isContador = userRole === "CONTADOR";

  // MENÚ LATERAL CON PERMISOS
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
          requiresFinance: true // ✅ Solo este requiere finanzas
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

  // ✅ Filtrar menú según rol Y permisos de finanzas
  const menuSections = allMenuSections
    .map(section => ({
      ...section,
      items: section.items.filter((item: any) => {
        // Si el item requiere acceso a finanzas
        if (item.requiresFinance) {
          // ADMIN y CONTADOR siempre lo ven
          if (userRole === "ADMIN_GENERAL" || userRole === "CONTADOR") {
            return true;
          }
          // COLABORADOR solo si tiene accesoFinanzas
          if (userRole === "COLABORADOR") {
            return accesoFinanzas;
          }
          return false;
        }
        // Items normales: verificar roles
        return item.roles.includes(userRole);
      })
    }))
    .filter(section => section.items.length > 0);

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

        {/* BOTÓN NUEVO DATO - Solo para ADMIN_GENERAL y COLABORADOR */}
        {!isContador && (
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            ＋ Nuevo Dato
          </button>
        )}
      </header>

      {/* MENÚ GIGANTE DE EVENTOS - Solo para ADMIN_GENERAL y COLABORADOR */}
      {menuOpen && !isContador && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex justify-center items-start pt-10 p-4"
          onClick={() => setMenuOpen(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-8 max-w-5xl w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Botón cerrar */}
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl leading-none"
            >
              ×
            </button>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
              
              {/* ANIMALES */}
              <div>
                <h3 className="font-bold mb-4 text-gray-800 text-sm uppercase tracking-wide">ANIMALES</h3>
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
                      className="w-full text-left flex items-center gap-2 text-sm py-2 px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <span className="text-base">{emoji}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AGRICULTURA */}
              <div>
                <h3 className="font-bold mb-4 text-gray-800 text-sm uppercase tracking-wide">AGRICULTURA</h3>
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
                      className="w-full text-left flex items-center gap-2 text-sm py-2 px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <span className="text-base">{emoji}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CLIMA */}
              <div>
                <h3 className="font-bold mb-4 text-gray-800 text-sm uppercase tracking-wide">CLIMA</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => openModal("lluvia")} 
                    className="w-full text-left flex items-center gap-2 text-sm py-2 px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-base">🌧️</span>
                    <span>Lluvia</span>
                  </button>
                  <button
                    onClick={() => openModal("helada")} 
                    className="w-full text-left flex items-center gap-2 text-sm py-2 px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-base">❄️</span>
                    <span>Helada</span>
                  </button>
                </div>
              </div>

              {/* INSUMOS */}
              <div>
                <h3 className="font-bold mb-4 text-gray-800 text-sm uppercase tracking-wide">INSUMOS</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => openModal("uso-insumos")} 
                    className="w-full text-left flex items-center gap-2 text-sm py-2 px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-base">📤</span>
                    <span>Uso</span>
                  </button>
                  <button
                    onClick={() => openModal("ingreso-insumos")} 
                    className="w-full text-left flex items-center gap-2 text-sm py-2 px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-base">📥</span>
                    <span>Ingreso</span>
                  </button>
                </div>
              </div>

              {/* FINANZAS */}
              <div>
                <h3 className="font-bold mb-4 text-gray-800 text-sm uppercase tracking-wide">FINANZAS</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => openModal("gasto")} 
                    className="w-full text-left flex items-center gap-2 text-sm py-2 px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-base">💰</span>
                    <span>Gasto</span>
                  </button>
                  <button
                    onClick={() => openModal("ingreso")} 
                    className="w-full text-left flex items-center gap-2 text-sm py-2 px-3 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-base">✅</span>
                    <span>Ingreso</span>
                  </button>
                </div>
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

                {section.items.map((item: any) => {
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