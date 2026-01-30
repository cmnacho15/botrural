'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Menu,
  X,
  Users,
  BarChart3,
  Mic,
  MessageSquare,
  Wheat,
  Sprout,
  DollarSign,
  Camera,
  FileText,
  Calendar,
  MapPin,
  Shield,
  PieChart,
  ClipboardList,
  RefreshCw,
  Bell,
  Globe,
  ArrowUpRight,
  Play
} from 'lucide-react';

// ============================================================
// DATOS DE LA LANDING
// ============================================================

const STATS = [
  { value: '100+', label: 'Productores' },
  { value: '250K+', label: 'Eventos registrados' },
  { value: '98%', label: 'Retención' },
  { value: '24/7', label: 'Disponibilidad' },
];

const HERO_CATEGORIES = [
  { icon: <Users className="w-5 h-5" />, label: 'Ganaderia' },
  { icon: <Wheat className="w-5 h-5" />, label: 'Agricultura' },
  { icon: <Sprout className="w-5 h-5" />, label: 'Insumos' },
  { icon: <DollarSign className="w-5 h-5" />, label: 'Finanzas' },
];

const WHATSAPP_FEATURES = [
  {
    icon: <Mic className="w-6 h-6" />,
    title: 'Audio inteligente',
    description: 'Graba un audio describiendo lo que paso y el bot lo interpreta y registra solo.',
    demo: 'audio',
  },
  {
    icon: <Camera className="w-6 h-6" />,
    title: 'Facturas con foto',
    description: 'Saca una foto a la factura. El bot lee proveedor, monto y categoria automaticamente.',
    demo: 'factura',
  },
  {
    icon: <Camera className="w-6 h-6" />,
    title: 'Foto + evento',
    description: 'Envia una foto con descripcion y queda guardada con el evento. Despues la consultas y te llega la imagen.',
    demo: 'fotoevento',
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: 'Consulta tus datos',
    description: '"Pasame los datos de los ultimos 5 dias" — recibis PDF + fotos adjuntas directo al chat.',
    demo: 'consulta',
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Calendario con IA',
    description: '"En 14 dias hacer tacto" — el bot programa el recordatorio y te avisa.',
    demo: 'calendario',
  },
];

const PLATFORM_FEATURES = [
  {
    icon: <PieChart className="w-7 h-7" />,
    title: 'Indicadores en tiempo real',
    description: 'Eficiencia tecnica, indicadores ganaderos y economicos. Carga animal por hectarea, costo por UG, rentabilidad — todo calculado automaticamente.',
    color: 'from-blue-500 to-indigo-600',
    tag: 'Dashboard',
  },
  {
    icon: <DollarSign className="w-7 h-7" />,
    title: 'Finanzas completas',
    description: 'Gastos pendientes y pagados, ingresos por cobrar y cobrados. Filtra por categoria, proveedor, fecha. Vincula facturas con fotos.',
    color: 'from-green-500 to-emerald-600',
    tag: 'Finanzas',
  },
  {
    icon: <RefreshCw className="w-7 h-7" />,
    title: 'Pastoreo Rotativo',
    description: 'Genera el historial de movimientos por modulo: dias de pastoreo, dias de descanso, hectareas. Exporta como PDF desde WhatsApp o la web.',
    color: 'from-amber-500 to-orange-600',
    tag: 'Reportes',
  },
  {
    icon: <ClipboardList className="w-7 h-7" />,
    title: 'Stock y categorias',
    description: 'Controla el stock por potrero y categoria. Nacimientos, mortandad, ventas y compras actualizan automaticamente. Integracion SNIG.',
    color: 'from-purple-500 to-violet-600',
    tag: 'Ganaderia',
  },
  {
    icon: <BarChart3 className="w-7 h-7" />,
    title: 'Costos desglosados',
    description: 'Costos variables, fijos y financieros. Asignacion automatica por especie. Costo por hectarea y por UG. Sabes exactamente cuanto te sale cada animal.',
    color: 'from-rose-500 to-pink-600',
    tag: 'Economia',
  },
  {
    icon: <Users className="w-7 h-7" />,
    title: 'Equipo y roles',
    description: 'Suma a tu capataz, veterinario o contador. Cada uno con su rol y permisos. Todos cargan datos por WhatsApp, vos controlas desde la web.',
    color: 'from-cyan-500 to-teal-600',
    tag: 'Equipo',
  },
];

const DETAILED_SECTIONS = [
  {
    badge: 'Indicadores',
    title: 'Toma decisiones con datos, no con intuicion',
    subtitle: 'Indicadores ganaderos, de eficiencia tecnica y economicos actualizados en tiempo real.',
    items: [
      'Carga animal por hectarea (UG/ha) con equivalencias personalizables',
      'Porcentaje de preñez, destete y señalada',
      'Costo por UG y rentabilidad por especie',
      'Evolucion de UG mes a mes con grafico historico',
      'Relacion lanar-vacuno y superficie mejorada',
      'Indicadores de eficiencia reproductiva (DAO, tacto)',
    ],
    visual: 'indicadores',
  },
  {
    badge: 'Finanzas',
    title: 'Cada peso de tu campo, controlado',
    subtitle: 'Gestiona gastos, ingresos, facturas y pagos. Exporta un Excel completo con todo.',
    items: [
      'Gastos pendientes vs pagados — filtra con un click',
      'Ingresos por cobrar vs cobrados por firma',
      'Foto de factura por WhatsApp = gasto registrado',
      'Excel con hojas de Ventas y Gastos, cada una con link a la factura adjunta',
      'Cotizacion del dolar del dia anterior incluida en cada registro',
      'Estado de cuenta por consignatario',
    ],
    visual: 'finanzas',
  },
  {
    badge: 'Pastoreo',
    title: 'Reporte de Pastoreo Rotativo en un click',
    subtitle: 'Historial completo de movimientos por modulo. Genera el PDF desde WhatsApp.',
    items: [
      'Fecha de entrada y salida por modulo',
      'Dias de pastoreo y dias de descanso calculados',
      'Hectareas por rotacion',
      'Movi animales por WhatsApp: "movi 50 vacas del norte al sur"',
      'PDF del historial completo de pastoreo',
      'Visualiza la rotacion en el mapa interactivo',
    ],
    visual: 'pastoreo',
  },
  {
    badge: 'Agricultura',
    title: 'Potreros y cultivos, de un vistazo',
    subtitle: 'Visualiza la distribucion de cultivos por potrero, superficie sembrada y mejoramientos en un treemap interactivo.',
    items: [
      'Treemap interactivo con superficie por potrero',
      'Cultivos asignados a cada potrero con detalle',
      'Superficie total por tipo de cultivo',
      'Registro de mejoramientos y estado actual',
    ],
    visual: 'agricultura',
  },
];

const WHATSAPP_EXAMPLES = [
  { user: 'llovieron 25mm', bot: 'Lluvia 25mm registrada' },
  { user: 'vacune 50 vacas contra aftosa en el sur', bot: 'Tratamiento: vacuna aftosa a 50 vacas en Sur' },
  { user: 'pasame los datos de los ultimos 5 dias', bot: 'PDF + fotos adjuntas enviadas' },
  { user: '[Foto] + murio un ternero en el norte', bot: 'Mortandad con foto guardada' },
  { user: 'movi 30 novillos del norte al sur', bot: 'Movimiento: 30 novillos de Norte a Sur' },
  { user: 'reporte de carga', bot: 'Generando PDF de carga actual...' },
  { user: 'en 14 dias hacer tacto', bot: 'Recordatorio programado' },
  { user: '[Foto de factura]', bot: 'Factura: Veterinaria Sur - $15.000' },
];


// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function CountUp({ target, suffix = '' }: { target: string; suffix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!isInView) return;
    const num = parseInt(target.replace(/\D/g, ''));
    if (isNaN(num)) { setDisplay(target); return; }
    const duration = 1500;
    const steps = 40;
    const increment = num / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= num) {
        clearInterval(timer);
        setDisplay(target);
      } else {
        setDisplay(Math.floor(current).toLocaleString());
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{display}{suffix}</span>;
}

function WhatsAppBubble({ text, isUser, delay = 0 }: { text: string; isUser: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm shadow-sm ${
        isUser
          ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
          : 'bg-white text-gray-800 rounded-tl-none'
      }`}>
        {!isUser && <span className="text-[#00934a] font-bold text-xs block mb-0.5">BotRural</span>}
        {text}
      </div>
    </motion.div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showMaiz, setShowMaiz] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setShowMaiz(prev => !prev), 3400);
    return () => clearInterval(interval);
  }, []);

  const startChatDemo = (demoType: string) => {
    setSelectedDemo(demoType);
    setChatMessages([]);

    const demos: Record<string, { userMsg: any; botResponse: any }> = {
      audio: {
        userMsg: { type: 'audio', sender: 'user', duration: '0:04', timestamp: '10:00' },
        botResponse: {
          type: 'text', sender: 'bot', timestamp: '10:01',
          text: {
            title: 'Entendi:',
            icon: '💉',
            summary: 'Tratamiento: vacuna aftosa a 50 vacas en Sur',
            buttons: ['Confirmar', 'Editar', 'Cancelar']
          }
        }
      },
      factura: {
        userMsg: { type: 'image', sender: 'user', timestamp: '10:00' },
        botResponse: {
          type: 'text', sender: 'bot', timestamp: '10:01',
          text: {
            title: 'Factura de Gasto detectada:',
            icon: '🧾',
            data: [
              { label: 'Proveedor', value: 'Veterinaria Sur' },
              { label: 'Monto', value: '$15.000' },
              { label: 'Concepto', value: 'Medicamentos' },
            ],
            buttons: ['Confirmar', 'Cancelar']
          }
        }
      },
      fotoevento: {
        userMsg: { type: 'imageWithCaption', sender: 'user', caption: 'murio un ternero en el norte', timestamp: '10:00' },
        botResponse: {
          type: 'text', sender: 'bot', timestamp: '10:01',
          text: {
            title: 'Entendi:',
            icon: '💀',
            summary: 'Mortandad: 1 ternero en Norte, con foto adjunta',
            buttons: ['Confirmar', 'Editar', 'Cancelar']
          }
        }
      },
      consulta: {
        userMsg: { type: 'text', sender: 'user', message: 'pasame los datos de los ultimos 5 dias', timestamp: '10:00' },
        botResponse: {
          type: 'text', sender: 'bot', timestamp: '10:01',
          text: {
            title: '23 registros',
            icon: '📊',
            summary: 'Generando PDF... + 3 fotos adjuntas',
            data: [
              { label: 'Lluvias', value: '4 registros' },
              { label: 'Tratamientos', value: '8 registros' },
              { label: 'Mortandades', value: '2 registros 📷' },
              { label: 'Tactos', value: '3 registros' },
            ],
          }
        }
      },
      calendario: {
        userMsg: { type: 'text', sender: 'user', message: 'en 14 dias hacer tacto en el sur', timestamp: '10:00' },
        botResponse: {
          type: 'text', sender: 'bot', timestamp: '10:01',
          text: {
            title: 'Actividad programada',
            icon: '📅',
            data: [
              { label: 'Tarea', value: 'Hacer tacto en el sur' },
              { label: 'Fecha', value: '13/02/2026' },
            ],
            buttons: ['Confirmar', 'Cancelar']
          }
        }
      },
    };

    const demo = demos[demoType] || demos.audio;

    setTimeout(() => {
      setChatMessages([demo.userMsg]);
    }, 300);

    setTimeout(() => setIsTyping(true), 1200);

    setTimeout(() => {
      setIsTyping(false);
      setChatMessages(prev => [...prev, demo.botResponse]);
    }, 2400);
  };

  return (
    <div className="min-h-screen bg-white">

      {/* ============================================================ */}
      {/* NAVIGATION */}
      {/* ============================================================ */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 w-full z-50 transition-all duration-300"
        style={{
          backgroundColor: scrollY > 50 ? 'rgba(0, 0, 0, 0.95)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(10px)' : 'none'
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
  <img src="/BoTRURAL.svg" alt="BotRural" className="h-12" />
</motion.div>

            <div className="hidden md:flex gap-8 items-center">
              <a href="#funcionalidades" className="text-white/80 hover:text-white transition-colors text-sm">Funcionalidades</a>
              <a href="#whatsapp" className="text-white/80 hover:text-white transition-colors text-sm">WhatsApp</a>
              <a href="#plataforma" className="text-white/80 hover:text-white transition-colors text-sm">Plataforma</a>
              <motion.a
                href="/login"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-purple-600 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg hover:bg-purple-700 transition-all"
              >
                Ingresar
              </motion.a>
            </div>

            <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden mt-4 py-4 flex flex-col gap-4"
              >
                <a href="#funcionalidades" className="text-white/90">Funcionalidades</a>
                <a href="#whatsapp" className="text-white/90">WhatsApp</a>
                <a href="#plataforma" className="text-white/90">Plataforma</a>
                <a href="/login" className="bg-purple-600 text-white px-6 py-2.5 rounded-lg font-semibold text-center">Ingresar</a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      {/* ============================================================ */}
      {/* HERO */}
      {/* ============================================================ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <motion.img
            animate={{ opacity: showMaiz ? 0 : 1 }}
            transition={{ duration: 1.5 }}
            src="campo.jpg"
            className="absolute inset-0 w-full h-full object-cover"
            alt="Campo"
          />
          <motion.img
            animate={{ opacity: showMaiz ? 1 : 0 }}
            transition={{ duration: 1.5 }}
            src="maiz.jpg"
            className="absolute inset-0 w-full h-full object-cover"
            alt="Maiz"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 w-full">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>

              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="inline-block bg-purple-500/20 text-purple-400 border border-purple-500/30 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
              >
                Plataforma de gestion rural con IA
              </motion.span>

              <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white leading-[1.1]">
                Tu campo en
                <br />
                <span className="text-[#00934a]">WhatsApp</span>
              </h1>

              <p className="text-lg md:text-xl text-white/80 mb-8 leading-relaxed max-w-lg">
                Registra eventos, facturas y datos con un audio o una foto.
                Consulta indicadores, genera reportes y controla finanzas — todo desde el celular.
              </p>

              {/* Category pills */}
              <div className="flex flex-wrap gap-3 mb-8">
                {HERO_CATEGORIES.map((cat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 rounded-full text-sm"
                  >
                    <span className="text-purple-400">{cat.icon}</span>
                    <span className="text-white font-medium">{cat.label}</span>
                  </motion.div>
                ))}
              </div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                className="flex flex-col sm:flex-row gap-4 mb-6"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  Probar gratis
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 rounded-xl text-lg font-semibold bg-white/10 border border-white/30 text-white hover:bg-white/20 backdrop-blur-sm transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Ver demo
                </motion.button>
              </motion.div>

              <p className="text-white/50 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-400 rounded-full" />
                Sin tarjeta de credito 
              </p>
            </motion.div>
          </div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md border-t border-white/10"
        >
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-purple-400">
                    <CountUp target={stat.value} />
                  </div>
                  <div className="text-white/60 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* WHATSAPP BOT DEMO */}
      {/* ============================================================ */}
      <section id="whatsapp" className="py-24 px-6 bg-gray-950 text-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="bg-[#00934a]/20 text-[#00934a] px-4 py-2 rounded-full text-sm font-semibold mb-4 inline-block">
              WhatsApp + IA
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Tan simple como mandar un audio
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Tu capataz no necesita aprender ninguna app. Manda un audio, un texto o una foto
              por WhatsApp y el bot registra todo con inteligencia artificial.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Feature buttons */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold mb-6 text-gray-300">Toca para ver la demo en vivo:</h3>
              {WHATSAPP_FEATURES.map((feature, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  onClick={() => startChatDemo(feature.demo)}
                  className={`w-full text-left p-5 rounded-2xl transition-all ${
                    selectedDemo === feature.demo
                      ? 'bg-[#00934a]/20 border-2 border-[#00934a]'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl shrink-0 ${
                      selectedDemo === feature.demo ? 'bg-[#00934a]' : 'bg-white/10'
                    }`}>
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-1">{feature.title}</h4>
                      <p className="text-gray-400 text-sm">{feature.description}</p>
                    </div>
                  </div>
                </motion.button>
              ))}

              {/* Extra: WhatsApp examples scrolling */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-gray-500 text-sm mb-4">Ejemplos de lo que podes decirle:</p>
                <div className="space-y-2">
                  {WHATSAPP_EXAMPLES.slice(0, 5).map((ex, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="text-[#00934a] shrink-0">{">"}</span>
                      <span className="text-gray-300">"{ex.user}"</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Phone Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative flex justify-center"
            >
              <div className="relative w-full max-w-sm">
                <div className="bg-gray-800 rounded-[3rem] p-3 shadow-2xl border-4 border-gray-700">
                  <div className="bg-white rounded-[2.5rem] overflow-hidden">
                    {/* Header */}
                    <div className="bg-[#075e54] px-4 py-5 flex items-center gap-3">
  <img src="/BoTRURAL.svg" alt="BotRural" className="w-10 h-10 rounded-full" />
  <div>
    <div className="font-bold text-white text-sm">BotRural</div>
    <div className="text-green-200 text-xs">en linea</div>
  </div>
</div>

                    {/* Chat */}
                    <div className="bg-[#ece5dd] min-h-[420px] max-h-[420px] overflow-y-auto p-3 space-y-2">
                      <AnimatePresence mode="wait">
                        {chatMessages.map((msg, i) => (
                          <motion.div
                            key={`${selectedDemo}-${i}`}
                            initial={{ opacity: 0, y: 15, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            {msg.type === 'imageWithCaption' ? (
                              <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-1.5 max-w-[75%] shadow-sm">
                                <div className="bg-gray-200 rounded-md h-28 flex items-center justify-center">
                                  <div className="text-center text-gray-400">
                                    <Camera className="w-6 h-6 mx-auto mb-1" />
                                    <span className="text-[10px]">IMG_2847.jpg</span>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-800 px-1.5 pt-1.5">{msg.caption}</p>
                                <div className="text-[10px] text-gray-500 text-right mt-0.5 px-1">{msg.timestamp}</div>
                              </div>
                            ) : msg.type === 'audio' ? (
                              <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-3 max-w-[85%] shadow-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-[#00934a] rounded-full flex items-center justify-center">
                                    <Play className="w-3 h-3 text-white ml-0.5" />
                                  </div>
                                  <div className="flex-1 flex items-end gap-[2px] h-6">
                                    {[...Array(25)].map((_, j) => (
                                      <div key={j} className="w-[3px] bg-[#075e54]/60 rounded-full"
                                        style={{ height: `${8 + Math.random() * 16}px` }} />
                                    ))}
                                  </div>
                                  <span className="text-xs text-gray-500">{msg.duration}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 text-right mt-1">{msg.timestamp}</div>
                              </div>
                            ) : msg.type === 'image' ? (
                              <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-1.5 max-w-[75%] shadow-sm">
                                <div className="bg-gray-200 rounded-md h-36 flex items-center justify-center">
                                  <div className="text-center text-gray-400">
                                    <Camera className="w-8 h-8 mx-auto mb-1" />
                                    <span className="text-xs">Factura.jpg</span>
                                  </div>
                                </div>
                                <div className="text-[10px] text-gray-500 text-right mt-1 px-1">{msg.timestamp}</div>
                              </div>
                            ) : msg.sender === 'user' ? (
                              <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
                                <p className="text-sm text-gray-800">{msg.message}</p>
                                <div className="text-[10px] text-gray-500 text-right mt-0.5">{msg.timestamp}</div>
                              </div>
                            ) : (
                              <div className="bg-white rounded-lg rounded-tl-none px-3 py-2.5 max-w-[90%] shadow-sm">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <span className="text-lg">{msg.text.icon}</span>
                                  <span className="font-bold text-sm text-gray-800">{msg.text.title}</span>
                                </div>
                                {msg.text.summary && (
                                  <p className="text-sm text-gray-700 mb-2">{msg.text.summary}</p>
                                )}
                                {msg.text.data && (
                                  <div className="space-y-1 text-sm">
                                    {msg.text.data.map((item: any, j: number) => (
                                      <div key={j}>
                                        <span className="font-semibold text-gray-700">{item.label}:</span>{' '}
                                        <span className="text-gray-600">{item.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {msg.text.buttons && (
                                  <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                                    {msg.text.buttons.map((btn: string, j: number) => (
                                      <span key={j} className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                                        j === 0
                                          ? 'bg-[#075e54]/10 text-[#00934a]'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}>{btn}</span>
                                    ))}
                                  </div>
                                )}
                                <div className="text-[10px] text-gray-400 text-right mt-1">{msg.timestamp}</div>
                              </div>
                            )}
                          </motion.div>
                        ))}

                        {isTyping && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                            <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
                              <div className="flex gap-1.5">
                                {[0, 1, 2].map(i => (
                                  <motion.div key={i}
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                                    className="w-2 h-2 bg-gray-400 rounded-full"
                                  />
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!selectedDemo && (
                        <div className="flex items-center justify-center h-[380px]">
                          <p className="text-gray-500 text-sm text-center px-8">
                            Selecciona un ejemplo para ver como funciona
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Input */}
                    <div className="bg-[#f0f0f0] px-3 py-2.5 flex items-center gap-2">
                      <div className="flex-1 bg-white rounded-full px-4 py-2 text-gray-400 text-sm">
                        Mensaje...
                      </div>
                      <div className="bg-[#075e54] rounded-full p-2.5">
                        <Mic className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Glows */}
                <div className="absolute -top-6 -right-6 w-28 h-28 bg-[#00934a]/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-6 -left-6 w-36 h-36 bg-[#00934a]/15 rounded-full blur-3xl" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PLATFORM FEATURES GRID */}
      {/* ============================================================ */}
      <section id="funcionalidades" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              Gestion completa de tu establecimiento: ganaderia, finanzas, costos, equipo y mas.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORM_FEATURES.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className="group bg-white border border-gray-200 p-7 rounded-2xl hover:shadow-xl hover:border-gray-300 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`bg-gradient-to-br ${feature.color} w-12 h-12 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{feature.tag}</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* DETAILED SECTIONS */}
      {/* ============================================================ */}
      <section id="plataforma" className="py-24 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto space-y-32">
          {DETAILED_SECTIONS.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className={`grid lg:grid-cols-2 gap-16 items-center ${
                index % 2 === 1 ? 'lg:direction-rtl' : ''
              }`}
            >
              {/* Content */}
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <span className="inline-block bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                  {section.badge}
                </span>
                <h3 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                  {section.title}
                </h3>
                <p className="text-lg text-gray-500 mb-8">
                  {section.subtitle}
                </p>
                <ul className="space-y-3">
                  {section.items.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-purple-600" />
                      </div>
                      <span className="text-gray-600">{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Visual placeholder */}
              <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-8 aspect-[4/3] flex items-center justify-center border border-gray-200 shadow-lg"
                >
                  {section.visual === 'indicadores' && (
                    <div className="w-full space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'UG/ha', value: '0.82', trend: '+5%' },
                          { label: 'Costo/UG', value: '$420', trend: '-3%' },
                          { label: 'Preñez', value: '78%', trend: '+2%' },
                        ].map((kpi, i) => (
                          <div key={i} className="bg-white rounded-xl p-3 text-center shadow-sm">
                            <div className="text-xs text-gray-400 mb-1">{kpi.label}</div>
                            <div className="text-xl font-bold text-gray-800">{kpi.value}</div>
                            <div className="text-xs text-green-600 font-medium">{kpi.trend}</div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="text-xs text-gray-400 mb-3">Evolucion UG (12 meses)</div>
                        <div className="flex items-end gap-1 h-20">
                          {[40, 45, 42, 48, 52, 55, 50, 58, 62, 60, 65, 68].map((h, i) => (
                            <div key={i} className="flex-1 bg-purple-500 rounded-t" style={{ height: `${h}%` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {section.visual === 'finanzas' && (
                    <div className="w-full space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                          <div className="text-xs text-red-400">Gastos pendientes</div>
                          <div className="text-lg font-bold text-red-600">$245.000</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                          <div className="text-xs text-green-500">Ingresos cobrados</div>
                          <div className="text-lg font-bold text-green-600">$890.000</div>
                        </div>
                      </div>
                      {/* Excel mockup */}
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                            <FileText className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs font-bold text-gray-700">exportar_campo.xlsx</span>
                        </div>
                        <div className="flex gap-1 mb-2">
                          <span className="text-[9px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">Ventas</span>
                          <span className="text-[9px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">Gastos</span>
                          <span className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Eventos</span>
                          <span className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Stock</span>
                        </div>
                        <div className="space-y-1 text-[9px]">
                          <div className="grid grid-cols-5 gap-1 text-gray-400 font-medium border-b border-gray-100 pb-1">
                            <span>Fecha</span><span>Detalle</span><span>Monto</span><span>USD</span><span>Factura</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1 text-gray-600">
                            <span>28/01</span><span>30 novillos</span><span>$450k</span><span>$423</span><span className="text-blue-500 underline">Ver</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1 text-gray-600">
                            <span>25/01</span><span>Veterinaria</span><span>$15k</span><span>$14</span><span className="text-blue-500 underline">Ver</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-600" />
                        <span className="text-[10px] text-amber-700 font-medium">Cotizacion dolar del dia anterior incluida en cada registro</span>
                      </div>
                    </div>
                  )}
                  {section.visual === 'pastoreo' && (
                    <div className="w-full space-y-3">
                      <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="text-sm font-bold text-gray-700 mb-3">Reporte de Pastoreo Rotativo</div>
                        <div className="space-y-2">
                          {[
                            { modulo: 'Norte', entrada: '05/01', salida: '19/01', dias: 14, descanso: 42 },
                            { modulo: 'Sur', entrada: '19/01', salida: '02/02', dias: 14, descanso: 38 },
                            { modulo: 'Este', entrada: '02/02', salida: '-', dias: 8, descanso: '-' },
                          ].map((row, i) => (
                            <div key={i} className="grid grid-cols-5 text-xs gap-2 py-2 border-b border-gray-50">
                              <span className="font-semibold text-gray-700">{row.modulo}</span>
                              <span className="text-gray-500">{row.entrada}</span>
                              <span className="text-gray-500">{row.salida}</span>
                              <span className="text-purple-600 font-medium">{row.dias}d</span>
                              <span className="text-amber-600">{row.descanso}{typeof row.descanso === 'number' ? 'd' : ''}</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-5 text-[10px] text-gray-400 mt-1 gap-2">
                          <span>Modulo</span><span>Entrada</span><span>Salida</span><span>Pastoreo</span><span>Descanso</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-700">pastoreo_rotativo.pdf</div>
                          <div className="text-xs text-gray-400">Generado desde WhatsApp</div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  )}
                  {section.visual === 'agricultura' && (
                    <div className="w-full space-y-3">
                      {/* Treemap de potreros */}
                      <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="text-sm font-bold text-gray-700 mb-3">Superficie por potrero</div>
                        <div className="grid grid-cols-4 grid-rows-3 gap-1.5" style={{ height: '180px' }}>
                          {/* Norte - grande */}
                          <div className="col-span-2 row-span-2 bg-amber-100 rounded-lg flex flex-col items-center justify-center border border-amber-200">
                            <span className="text-sm font-bold text-amber-800">Norte</span>
                            <span className="text-xs text-amber-600">120 ha</span>
                          </div>
                          {/* Sur */}
                          <div className="col-span-2 row-span-1 bg-pink-100 rounded-lg flex flex-col items-center justify-center border border-pink-200">
                            <span className="text-sm font-bold text-pink-800">Sur</span>
                            <span className="text-xs text-pink-600">85 ha</span>
                          </div>
                          {/* Este */}
                          <div className="col-span-1 row-span-1 bg-emerald-100 rounded-lg flex flex-col items-center justify-center border border-emerald-200">
                            <span className="text-xs font-bold text-emerald-800">Este</span>
                            <span className="text-[10px] text-emerald-600">60 ha</span>
                          </div>
                          {/* Oeste */}
                          <div className="col-span-1 row-span-1 bg-violet-100 rounded-lg flex flex-col items-center justify-center border border-violet-200">
                            <span className="text-xs font-bold text-violet-800">Oeste</span>
                            <span className="text-[10px] text-violet-600">45 ha</span>
                          </div>
                          {/* Costa */}
                          <div className="col-span-2 row-span-1 bg-amber-50 rounded-lg flex flex-col items-center justify-center border border-amber-100">
                            <span className="text-xs font-bold text-amber-700">Costa</span>
                            <span className="text-[10px] text-amber-500">35 ha</span>
                          </div>
                        </div>
                      </div>
                      {/* Mini-lista de cultivos */}
                      <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="text-sm font-bold text-gray-700 mb-3">Cultivos — superficie total</div>
                        <div className="space-y-2">
                          {[
                            { cultivo: 'Pradera', ha: '145 ha', color: 'bg-emerald-400' },
                            { cultivo: 'Avena', ha: '85 ha', color: 'bg-amber-400' },
                            { cultivo: 'Sorgo', ha: '60 ha', color: 'bg-pink-400' },
                            { cultivo: 'Campo natural', ha: '55 ha', color: 'bg-violet-400' },
                          ].map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-sm ${c.color} shrink-0`} />
                              <span className="text-xs text-gray-700 flex-1">{c.cultivo}</span>
                              <span className="text-xs font-semibold text-gray-600">{c.ha}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* EXTRA FEATURES BAR */}
      {/* ============================================================ */}
      <section className="py-16 px-6 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-center text-lg font-semibold text-gray-400 mb-10 uppercase tracking-wider">Y tambien...</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {[
              { icon: <MapPin className="w-5 h-5" />, label: 'Mapa interactivo' },
              { icon: <Calendar className="w-5 h-5" />, label: 'Calendario IA' },
              { icon: <Shield className="w-5 h-5" />, label: 'Roles y permisos' },
              { icon: <Globe className="w-5 h-5" />, label: 'Multi-campo' },
              { icon: <FileText className="w-5 h-5" />, label: 'Exportar Excel' },
              { icon: <Bell className="w-5 h-5" />, label: 'Recordatorios' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col items-center gap-2 text-center py-4"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                  {item.icon}
                </div>
                <span className="text-sm text-gray-600 font-medium">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* ============================================================ */}
      {/* FINAL CTA */}
      {/* ============================================================ */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 md:p-16 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-5" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Empeza a gestionar tu campo hoy
            </h2>
            <p className="text-xl mb-8 text-gray-400 max-w-2xl mx-auto">
              En 2 minutos tenes tu campo configurado. Sin tarjeta, sin compromiso.
              Tu equipo registra datos por WhatsApp desde el primer dia.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group bg-purple-500 hover:bg-purple-600 text-white px-10 py-5 rounded-xl text-xl font-bold shadow-lg transition-all inline-flex items-center gap-3"
            >
              Crear cuenta gratis
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER */}
      {/* ============================================================ */}
      <footer className="bg-gray-950 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
  <img src="/BoTRURAL.svg" alt="BotRural" className="h-10" />
</div>
              <p className="text-gray-500 text-sm">
                Gestion de campo simplificada con inteligencia artificial y WhatsApp.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Producto</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#funcionalidades" className="hover:text-purple-400 transition-colors">Funcionalidades</a></li>
                <li><a href="#whatsapp" className="hover:text-purple-400 transition-colors">Bot WhatsApp</a></li>
                <li><a href="#plataforma" className="hover:text-purple-400 transition-colors">Plataforma</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Recursos</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-purple-400 transition-colors">Guia de uso</a></li>
                <li><a href="#" className="hover:text-purple-400 transition-colors">Soporte</a></li>
                <li><a href="#" className="hover:text-purple-400 transition-colors">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-purple-400 transition-colors">Privacidad</a></li>
                <li><a href="#" className="hover:text-purple-400 transition-colors">Terminos</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-600 text-sm">
            2026 BotRural. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}