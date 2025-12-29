"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

import { DatosProvider } from "@/app/contexts/DatosContext";
import { InsumosProvider } from "@/app/contexts/InsumosContext";
import { GastosProvider } from "@/app/contexts/GastosContext";

import ModalNuevoDato from "@/app/components/modales/ModalNuevoDato";
import OnboardingIndicator from "@/app/components/OnboardingIndicator";

import { SuperficieProvider } from "@/app/contexts/SuperficieContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperficieProvider>
      <DatosProvider>
        <InsumosProvider>
          <GastosProvider>
            <LayoutContent>{children}</LayoutContent>
          </GastosProvider>
        </InsumosProvider>
      </DatosProvider>
    </SuperficieProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<string | null>(null);
  
  const userMenuRef = useRef<HTMLDivElement>(null);

  const campoNombre = session?.user?.campoNombre || "Mi Campo";
  const userName = session?.user?.name || "Usuario";
  const userEmail = session?.user?.email || "";

  // 🆕 Estado para campos del usuario
  const [campos, setCampos] = useState<Array<{id: string, nombre: string, rol: string, esActivo: boolean}>>([]);
  const [mostrarModalNuevoCampo, setMostrarModalNuevoCampo] = useState(false);
const [nombreNuevoCampo, setNombreNuevoCampo] = useState("");
const [creandoCampo, setCreandoCampo] = useState(false);
const [grupos, setGrupos] = useState<Array<{id: string, nombre: string, esActivo: boolean, cantidadCampos: number}>>([]);
const [opcionGrupo, setOpcionGrupo] = useState<'mismo' | 'nuevo'>('mismo');
const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState("");

  // 🆕 Cargar campos y grupos del usuario
useEffect(() => {
  async function cargarDatos() {
    try {
      const [resCampos, resGrupos] = await Promise.all([
        fetch('/api/campos'),
        fetch('/api/grupos')
      ]);
      
      if (resCampos.ok) {
        const data = await resCampos.json();
        setCampos(data);
      }
      
      if (resGrupos.ok) {
        const data = await resGrupos.json();
        setGrupos(data);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }
  cargarDatos();
}, []);

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

  // Cerrar menú de usuario al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  if (status === "loading" || !session?.user?.role) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  // Obtener inicial del campo para el avatar
  const campoInicial = campoNombre.charAt(0).toUpperCase();

  const openModal = (tipo: string) => {
    setModalTipo(tipo);
    setMenuOpen(false);
  };

  const closeModal = () => setModalTipo(null);

  // 🆕 Función para crear nuevo campo
const crearNuevoCampo = async () => {
  if (!nombreNuevoCampo.trim() || nombreNuevoCampo.trim().length < 2) {
    alert('El nombre debe tener al menos 2 caracteres');
    return;
  }

  if (opcionGrupo === 'nuevo' && (!nombreNuevoGrupo.trim() || nombreNuevoGrupo.trim().length < 2)) {
    alert('El nombre del cliente/empresa debe tener al menos 2 caracteres');
    return;
  }
  
  setCreandoCampo(true);
  try {
    const grupoActivo = grupos.find(g => g.esActivo);
    
    const payload: any = { nombre: nombreNuevoCampo.trim() };
    
    if (opcionGrupo === 'mismo' && grupoActivo) {
      payload.grupoId = grupoActivo.id;
    } else if (opcionGrupo === 'nuevo') {
      payload.nuevoGrupoNombre = nombreNuevoGrupo.trim();
    }

    const res = await fetch('/api/campos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (res.ok) {
      setMostrarModalNuevoCampo(false);
      setNombreNuevoCampo("");
      setNombreNuevoGrupo("");
      setOpcionGrupo('mismo');
      window.location.reload();
    } else {
      const error = await res.json();
      alert(error.error || 'Error al crear campo');
    }
  } catch (error) {
    alert('Error al crear campo');
  } finally {
    setCreandoCampo(false);
  }
};

  // 🆕 Función para cambiar campo activo
  const cambiarCampoActivo = async (campoId: string) => {
    try {
      const res = await fetch('/api/usuarios/campo-activo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campoId }),
      });
      
      if (res.ok) {
        setUserMenuOpen(false);
        window.location.reload();
      } else {
        const error = await res.json();
        alert(error.error || 'Error al cambiar campo');
      }
    } catch (error) {
      alert('Error al cambiar campo');
    }
  };

  const userRole = session?.user?.role || "COLABORADOR";
  const accesoFinanzas = session?.user?.accesoFinanzas || false;
  const isContador = userRole === "CONTADOR";

  const allMenuSections = [
    {
      title: "Mi Campo",
      items: [
        { href: "/dashboard", icon: "📊", label: "Resumen", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: false },
        { href: "/dashboard/datos", icon: "📝", label: "Datos", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/mapa", icon: "🗺️", label: "Mapa", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/lotes", icon: "🏞️", label: "Potreros", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/indicadores", icon: "📈", label: "Indicadores", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
      ],
    },
    {
      title: "Gestión",
      items: [
        { href: "/dashboard/costos", icon: "💵", label: "Costos", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
        { href: "/dashboard/ventas", icon: "💰", label: "Ventas", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
        { href: "/dashboard/compras", icon: "🛒", label: "Compras", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
        { href: "/dashboard/consumo", icon: "🥩", label: "Consumo", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
        { href: "/dashboard/inventario", icon: "📊", label: "Diferencia Inventario", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
        { href: "/dashboard/traslados", icon: "🚚", label: "Traslados", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
      ],
    },
    {
      title: "Otros",
      items: [
        { href: "/dashboard/gastos", icon: "💸", label: "Finanzas", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
        { href: "/dashboard/insumos", icon: "📦", label: "Insumos", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/calendario", icon: "📅", label: "Calendario", roles: ["ADMIN_GENERAL", "COLABORADOR", "EMPLEADO"], requiresFinance: false },
        { href: "/dashboard/mano-de-obra", icon: "👷", label: "Mano de Obra", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: false },
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
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-white border-b px-3 sm:px-4 py-3 flex items-center justify-between sticky top-0 z-40">
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
            width={140}
            height={140}
            priority
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botón Nuevo Dato */}
          {!isContador && (
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="px-3 py-2 sm:px-4 text-sm sm:text-base bg-blue-500 text-white rounded-lg hover:bg-blue-600 whitespace-nowrap"
            >
              ＋ Nuevo Dato
            </button>
          )}

          {/* Botón de Campo/Usuario */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-lg">⚙️</span>
              <span className="hidden sm:inline text-sm font-medium text-gray-700">
                {campoNombre}
              </span>
            </button>

            {/* Menú desplegable */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                {/* Header del menú con nombre de usuario */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <h3 className="text-white font-bold text-lg">{userName}</h3>
                  <p className="text-blue-100 text-sm">{userEmail}</p>
                </div>

                {/* Campo actual y lista de campos */}
                <div className="p-3 bg-blue-50 border-b border-blue-100">
                  <p className="text-xs text-gray-600 font-medium mb-2">Mis campos</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {campos.map((campo) => (
                      <button
                        key={campo.id}
                        onClick={() => !campo.esActivo && cambiarCampoActivo(campo.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          campo.esActivo 
                            ? 'bg-green-100 border-2 border-green-500' 
                            : 'bg-white hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${
                          campo.esActivo ? 'bg-green-600' : 'bg-gray-400'
                        }`}>
                          {campo.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`font-semibold text-sm ${campo.esActivo ? 'text-green-800' : 'text-gray-700'}`}>
                            {campo.nombre}
                          </p>
                          <p className="text-xs text-gray-500">{campo.rol === 'ADMIN_GENERAL' ? 'Admin' : campo.rol}</p>
                        </div>
                        {campo.esActivo && <span className="text-green-600 text-lg">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opciones del menú */}
                <div className="py-2">
                  {/* Cómo Empezar */}
                  <Link
                    href="/dashboard/como-empezar"
                    className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <span className="text-xl">🚀</span>
                    <span className="text-gray-700 font-medium">Cómo Empezar</span>
                  </Link>

                  {/* Suscribir - Deshabilitado por ahora */}
                  <div className="flex items-center gap-3 px-6 py-3 opacity-50 cursor-not-allowed">
                    <span className="text-xl">💳</span>
                    <div className="flex-1">
                      <span className="text-gray-700 font-medium">Suscribir</span>
                      <p className="text-xs text-gray-500">Próximamente</p>
                    </div>
                  </div>

                  {/* Agregar Campo */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setMostrarModalNuevoCampo(true);
                    }}
                    className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors border-t border-gray-100"
                  >
                    <span className="text-xl">➕</span>
                    <span className="text-gray-700 font-medium">Agregar Campo</span>
                  </button>

                  {/* Mis Pagos - Deshabilitado por ahora */}
                  <div className="flex items-center gap-3 px-6 py-3 opacity-50 cursor-not-allowed">
                    <span className="text-xl">⚙️</span>
                    <div className="flex-1">
                      <span className="text-gray-700 font-medium">Mis Pagos</span>
                      <p className="text-xs text-gray-500">Próximamente</p>
                    </div>
                  </div>

                  {/* Cerrar Sesión */}
                  <a
                    href="/auth/signout"
                    className="flex items-center gap-3 px-6 py-3 hover:bg-red-50 transition-colors border-t border-gray-100 mt-2"
                  >
                    <span className="text-xl">⏻</span>
                    <span className="text-red-600 font-medium">Cerrar Sesión</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
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
      <div className="flex flex-1">
        <aside
          className={`fixed lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] inset-y-0 left-0 w-64 sm:w-72 lg:w-60 bg-white border-r transition-transform duration-300 z-30 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } overflow-y-auto`}
        >
          <nav className="p-3 sm:p-4 space-y-2.5 pb-20 lg:pb-4">
            {/* Indicador compacto que se integra con el resto del menú */}
            <OnboardingIndicator variant="compact" />

            {menuSections.map((section, i) => (
              <div key={i}>
                <h3 className="text-xs text-gray-500 px-3 sm:px-4 mb-1.5 font-medium">
                  {section.title === "Mi Campo" ? campoNombre : section.title}
                </h3>

                {section.items.map((item: any) => {
                  const isActive = item.href === "/dashboard" 
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-sm ${
                        isActive
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="text-base">{item.icon}</span> 
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">{children}</main>
      </div>

      {/* 🆕 MODAL NUEVO CAMPO */}
{mostrarModalNuevoCampo && (
  <div 
    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    onClick={() => setMostrarModalNuevoCampo(false)}
  >
    <div 
      className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-xl font-bold text-gray-900 mb-4">Agregar Nuevo Campo</h2>
      
      {/* Nombre del campo */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre del campo
        </label>
        <input
          type="text"
          value={nombreNuevoCampo}
          onChange={(e) => setNombreNuevoCampo(e.target.value)}
          placeholder="Ej: Estancia San Pedro"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
      </div>

      {/* Pregunta sobre grupo - solo si ya tiene campos */}
      {campos.length > 0 && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            ¿Este campo es del mismo dueño/empresa que tus otros campos?
          </label>
          
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={opcionGrupo === 'mismo'}
                onChange={() => setOpcionGrupo('mismo')}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700">
                Sí, es del mismo dueño
                <span className="text-gray-500 text-xs ml-1">
                  (podrás hacer traslados entre campos)
                </span>
              </span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={opcionGrupo === 'nuevo'}
                onChange={() => setOpcionGrupo('nuevo')}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700">
                No, es de otro cliente/empresa
              </span>
            </label>
          </div>

          {/* Nombre del nuevo grupo */}
          {opcionGrupo === 'nuevo' && (
            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">
                Nombre del cliente/empresa
              </label>
              <input
                type="text"
                value={nombreNuevoGrupo}
                onChange={(e) => setNombreNuevoGrupo(e.target.value)}
                placeholder="Ej: Estancia Don Pedro"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}
        </div>
      )}
      
      <div className="flex gap-3">
        <button
          onClick={() => {
            setMostrarModalNuevoCampo(false);
            setNombreNuevoCampo("");
            setNombreNuevoGrupo("");
            setOpcionGrupo('mismo');
          }}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={crearNuevoCampo}
          disabled={creandoCampo || nombreNuevoCampo.trim().length < 2 || (opcionGrupo === 'nuevo' && nombreNuevoGrupo.trim().length < 2)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {creandoCampo ? 'Creando...' : 'Crear Campo'}
        </button>
      </div>
    </div>
  </div>
)}

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