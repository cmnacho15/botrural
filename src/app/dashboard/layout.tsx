"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { DatosProvider } from "@/app/contexts/DatosContext";
import { InsumosProvider } from "@/app/contexts/InsumosContext";
import { GastosProvider } from "@/app/contexts/GastosContext";

import ModalNuevoDato from "@/app/components/modales/ModalNuevoDato";
import ModalExportExcel from "@/app/components/modales/ModalExportExcel";
import OnboardingIndicator from "@/app/components/OnboardingIndicator";
import BannerRecategorizacion from "@/app/components/BannerRecategorizacion";

import { SuperficieProvider } from "@/app/contexts/SuperficieContext";
import { TipoCampoProvider } from "@/app/contexts/TipoCampoContext";
import { toast } from '@/app/components/Toast'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TipoCampoProvider>
      <SuperficieProvider>
        <DatosProvider>
          <InsumosProvider>
            <GastosProvider>
              <LayoutContent>{children}</LayoutContent>
            </GastosProvider>
          </InsumosProvider>
        </DatosProvider>
      </SuperficieProvider>
    </TipoCampoProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [tieneCamposEnGrupo, setTieneCamposEnGrupo] = useState(false)
  
  const userMenuRef = useRef<HTMLDivElement>(null);

  const campoNombre = session?.user?.campoNombre || "Mi Campo";
  const userName = session?.user?.name || "Usuario";
  const userEmail = session?.user?.email || "";

  // 🆕 Estado para campos del usuario
  const [campos, setCampos] = useState<Array<{id: string, nombre: string, rol: string, esActivo: boolean, grupoId: string | null}>>([]);
  const [mostrarModalNuevoCampo, setMostrarModalNuevoCampo] = useState(false);
const [nombreNuevoCampo, setNombreNuevoCampo] = useState("");
const [creandoCampo, setCreandoCampo] = useState(false);
const [grupos, setGrupos] = useState<Array<{id: string, nombre: string, esActivo: boolean, cantidadCampos: number}>>([]);
const [opcionGrupo, setOpcionGrupo] = useState<'existente' | 'nuevo'>('existente');
const [grupoSeleccionadoId, setGrupoSeleccionadoId] = useState('');
const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState("");
const [editandoGrupo, setEditandoGrupo] = useState<string | null>(null);
const [nombreGrupoEdit, setNombreGrupoEdit] = useState("");

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
  
  // 🔥 Verificar si hay otros campos en el mismo grupo
  const campoActivo = data.find((c: any) => c.esActivo)
  const grupoActivo = campoActivo?.grupoId
  const otrosCampos = data.filter((c: any) => 
    !c.esActivo && c.grupoId === grupoActivo
  )
  setTieneCamposEnGrupo(otrosCampos.length > 0)
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

  // Bloquear scroll del body cuando el menú de usuario está abierto (mobile)
  useEffect(() => {
    if (userMenuOpen && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    };
  }, [userMenuOpen]);

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  if (!session?.user?.role) {
    return null;
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
    toast.error('El nombre debe tener al menos 2 caracteres');
    return;
  }

  if (opcionGrupo === 'nuevo' && (!nombreNuevoGrupo.trim() || nombreNuevoGrupo.trim().length < 2)) {
    toast.error('El nombre del cliente/empresa debe tener al menos 2 caracteres');
    return;
  }

  if (opcionGrupo === 'existente' && !grupoSeleccionadoId && campos.length > 0) {
    toast.error('Seleccioná un grupo');
    return;
  }
  
  setCreandoCampo(true);
  try {
    const payload: any = { nombre: nombreNuevoCampo.trim() };
    
    if (opcionGrupo === 'existente' && grupoSeleccionadoId) {
      payload.grupoId = grupoSeleccionadoId;
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
      setGrupoSeleccionadoId("");
      setOpcionGrupo('existente');
      window.location.reload();
    } else {
      const error = await res.json();
      toast.error(error.error || 'Error al crear campo');
    }
  } catch (error) {
    toast.error('Error al crear campo');
  } finally {
    setCreandoCampo(false);
  }
};


// 🆕 Función para editar nombre del grupo
const guardarNombreGrupo = async (grupoId: string) => {
  if (!nombreGrupoEdit.trim() || nombreGrupoEdit.trim().length < 2) {
    toast.error('El nombre debe tener al menos 2 caracteres');
    return;
  }
  
  try {
    const res = await fetch('/api/grupos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: grupoId, nombre: nombreGrupoEdit.trim() }),
    });
    
    if (res.ok) {
      setEditandoGrupo(null);
      setNombreGrupoEdit("");
      // Recargar grupos
      const resGrupos = await fetch('/api/grupos');
      if (resGrupos.ok) {
        setGrupos(await resGrupos.json());
      }
    } else {
      toast.error('Error al guardar');
    }
  } catch (error) {
    toast.error('Error al guardar');
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
        toast.error(error.error || 'Error al cambiar campo');
      }
    } catch (error) {
      toast.error('Error al cambiar campo');
    }
  };

  const userRole = session?.user?.role || "COLABORADOR";
  const accesoFinanzas = session?.user?.accesoFinanzas || false;
  const isContador = userRole === "CONTADOR";
  const isMegaAdmin = userRole === "MEGA_ADMIN";

  const allMenuSections = [
    {
      title: "Mi Campo",
      items: [
        { href: "/dashboard", icon: "📊", label: "Resumen", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: false },
        { href: "/dashboard/datos", icon: "📝", label: "Datos", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/mapa", icon: "🗺️", label: "Mapa", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/lotes", icon: "🏞️", label: "Potreros", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false },
        { href: "/dashboard/gastos", icon: "💸", label: "Finanzas", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
        { href: "/dashboard/indicadores", icon: "📈", label: "Indicadores", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
      ],
    },
    {
  title: "Gestión",
  items: [
    { href: "/dashboard/costos", icon: "💵", label: "Costos", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
    { href: "/dashboard/ventas", icon: "💰", label: "Ventas", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
    { href: "/dashboard/compras", icon: "🛒", label: "Compras", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
    { href: "/dashboard/consumo", icon: "🥩🐑", label: "Consumo y Lana", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
    { href: "/dashboard/inventario", icon: "📊", label: "Diferencia Inventario", roles: ["ADMIN_GENERAL", "COLABORADOR", "CONTADOR"], requiresFinance: true },
    ...(tieneCamposEnGrupo ? [{ href: "/dashboard/traslados", icon: "🚚", label: "Traslados", roles: ["ADMIN_GENERAL", "COLABORADOR"], requiresFinance: false }] : []),
  ],
},
    {
      title: "Otros",
      items: [
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
        // MEGA_ADMIN tiene acceso total
        if (isMegaAdmin) return true;

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
      <header className="bg-white border-b px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 sm:p-2 rounded-lg text-gray-600 lg:hidden hover:bg-gray-100"
            aria-label="Abrir menú"
          >
            ☰
          </button>

          <img
            src="/BoTRURAL.svg"
            alt="BotRural"
            className="h-8 sm:h-10 w-auto"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Botón Descargar Excel */}
          <button
            onClick={() => setShowExportModal(true)}
            className="p-2 bg-green-100 border border-green-300 rounded-lg hover:bg-green-200 text-green-600 transition"
            title="Descargar a Excel"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {/* Botón Nuevo Dato */}
          {!isContador && (
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 whitespace-nowrap"
            >
              <span className="sm:hidden">＋ Nuevo</span>
              <span className="hidden sm:inline">＋ Nuevo Dato</span>
            </button>
          )}

          {/* Botón de Campo/Usuario */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-base sm:text-lg">⚙️</span>
              <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-[120px] truncate">
                {campoNombre}
              </span>
            </button>

            {/* Menú desplegable */}
            {userMenuOpen && (
              <>
              {/* Overlay mobile - bloquea scroll del body */}
              <div
                className="fixed inset-0 bg-black/40 z-40 sm:hidden"
                onClick={() => setUserMenuOpen(false)}
                style={{ colorScheme: 'light', touchAction: 'none' }}
              />
              <div
                className="fixed inset-0 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72 sm:max-w-sm bg-white sm:rounded-xl sm:shadow-2xl sm:border sm:border-gray-200 overflow-hidden flex flex-col"
                style={{ colorScheme: 'light' }}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {/* Header del menú con nombre de usuario */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0">
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-base sm:text-lg truncate">{userName}</h3>
                    <p className="text-blue-100 text-xs sm:text-sm truncate">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => setUserMenuOpen(false)}
                    className="sm:hidden text-white/80 hover:text-white p-1 -mr-1 shrink-0"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Contenido scrollable */}
                <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                {/* Campo actual y lista de campos agrupados */}
<div className="p-3 bg-blue-50 border-b border-blue-100" style={{ colorScheme: 'light' }}>
  <div className="space-y-3 max-h-60 overflow-y-auto">
    {grupos.map((grupo) => {
      const camposDelGrupo = campos.filter(c => c.grupoId === grupo.id);
      if (camposDelGrupo.length === 0) return null;
      
      return (
        <div key={grupo.id}>
          {/* Mostrar nombre del grupo solo si hay más de 1 grupo */}
          {grupos.length > 1 && (
            <div className="flex items-center gap-1 mb-1 px-1">
              {editandoGrupo === grupo.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={nombreGrupoEdit}
                    onChange={(e) => setNombreGrupoEdit(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 border rounded"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') guardarNombreGrupo(grupo.id);
                      if (e.key === 'Escape') setEditandoGrupo(null);
                    }}
                  />
                  <button
                    onClick={() => guardarNombreGrupo(grupo.id)}
                    className="text-green-600 hover:text-green-800 text-xs"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setEditandoGrupo(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 font-medium flex-1">
                    {grupo.nombre}
                  </p>
                  <button
                    onClick={() => {
                      setEditandoGrupo(grupo.id);
                      setNombreGrupoEdit(grupo.nombre);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                    title="Editar nombre"
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>
          )}

          <div className="space-y-1">
            {camposDelGrupo.map((campo) => (
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
      );
    })}
    
    {/* Campos sin grupo (compatibilidad) */}
    {campos.filter(c => !c.grupoId).length > 0 && (
      <div>
        {grupos.length > 0 && (
          <p className="text-xs text-gray-500 font-medium mb-1 px-1">Otros</p>
        )}
        <div className="space-y-1">
          {campos.filter(c => !c.grupoId).map((campo) => (
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
    )}
  </div>
</div>


                {/* Opciones del menú */}
                <div className="py-2 bg-white" style={{ colorScheme: 'light' }}>
                  {/* Panel Admin - Solo para MEGA_ADMIN */}
                  {isMegaAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-purple-50 transition-colors bg-purple-50 border-b border-purple-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <span className="text-xl">🛡️</span>
                      <span className="text-purple-700 font-medium text-sm sm:text-base">Panel Admin</span>
                    </Link>
                  )}

                  {/* Cómo Empezar */}
                  <Link
                    href="/dashboard/como-empezar"
                    className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <span className="text-xl">🚀</span>
                    <span className="text-gray-700 font-medium text-sm sm:text-base">Cómo Empezar</span>
                  </Link>

                  {/* Suscribir - Deshabilitado por ahora */}
                  <div className="flex items-center gap-3 px-4 sm:px-6 py-3 opacity-50 cursor-not-allowed">
                    <span className="text-xl">💳</span>
                    <div className="flex-1">
                      <span className="text-gray-700 font-medium text-sm sm:text-base">Suscribir</span>
                      <p className="text-xs text-gray-500">Próximamente</p>
                    </div>
                  </div>

                  {/* Agregar Campo */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setMostrarModalNuevoCampo(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors border-t border-gray-100"
                  >
                    <span className="text-xl">➕</span>
                    <span className="text-gray-700 font-medium text-sm sm:text-base">Agregar Campo</span>
                  </button>

                  {/* Mis Pagos - Deshabilitado por ahora */}
                  <div className="flex items-center gap-3 px-4 sm:px-6 py-3 opacity-50 cursor-not-allowed">
                    <span className="text-xl">⚙️</span>
                    <div className="flex-1">
                      <span className="text-gray-700 font-medium text-sm sm:text-base">Mis Pagos</span>
                      <p className="text-xs text-gray-500">Próximamente</p>
                    </div>
                  </div>

                  {/* Cerrar Sesión */}
                  <a
                    href="/auth/signout"
                    className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-red-50 transition-colors border-t border-gray-100 mt-2"
                  >
                    <span className="text-xl">⏻</span>
                    <span className="text-red-600 font-medium">Cerrar Sesión</span>
                  </a>
                </div>
                </div>{/* cierra div scrollable */}
              </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* BANNER RECATEGORIZACIÓN */}
      <BannerRecategorizacion />

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
                    ...(tieneCamposEnGrupo ? [["traslado", "🚚", "Traslado"]] : []),
                    ["nacimiento", "🐄", "Nacimiento"],
                    ["mortandad", "💀", "Mortandad"],
                    ["consumo", "🥩", "Consumo"],
                    ["aborto", "❌", "Aborto"],
                    ["destete", "🍼", "Destete"],
                    ["tacto", "✋", "Tacto"],
                    ["recategorizacion", "🏷️", "Recategorización"],
                    ["dao", "🔬", "DAO"],  // ← AGREGAR ESTA LÍNEA
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
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div className="flex flex-1">
        <aside
          className={`fixed lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] top-0 bottom-0 left-0 w-64 sm:w-72 lg:w-60 bg-white border-r transition-transform duration-300 z-50 lg:z-30 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } overflow-y-auto`}
        >
          {/* Header del sidebar en móvil con logo y botón cerrar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 lg:hidden">
            <img src="/BoTRURAL.svg" alt="BotRural" className="h-8 w-auto" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Cerrar menú"
            >
              ✕
            </button>
          </div>
          <nav className="p-3 sm:p-4 space-y-2.5 pb-20 lg:pb-4">
            {/* Indicador compacto que se integra con el resto del menú */}
            <OnboardingIndicator variant="compact" onClick={() => setSidebarOpen(false)} />

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
            ¿A qué grupo/empresa pertenece este campo?
          </label>
          
          <div className="space-y-2">
            {grupos.map((grupo) => (
              <label key={grupo.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={opcionGrupo === 'existente' && grupoSeleccionadoId === grupo.id}
                  onChange={() => {
                    setOpcionGrupo('existente')
                    setGrupoSeleccionadoId(grupo.id)
                  }}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  {grupo.nombre}
                  <span className="text-gray-500 text-xs ml-1">
                    ({grupo.cantidadCampos} campo{grupo.cantidadCampos !== 1 ? 's' : ''})
                  </span>
                </span>
              </label>
            ))}
            
            <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-gray-200 mt-2">
              <input
                type="radio"
                checked={opcionGrupo === 'nuevo'}
                onChange={() => {
                  setOpcionGrupo('nuevo')
                  setGrupoSeleccionadoId('')
                }}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700">
                + Crear nuevo grupo/empresa
              </span>
            </label>
          </div>

          {/* Nombre del nuevo grupo */}
          {opcionGrupo === 'nuevo' && (
            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">
                Nombre del nuevo grupo/empresa
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
            setGrupoSeleccionadoId("");
            setOpcionGrupo('existente');
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

      {/* MODAL EXPORTAR EXCEL */}
      <ModalExportExcel
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}