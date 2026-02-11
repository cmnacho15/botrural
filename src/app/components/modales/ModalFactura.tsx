import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Download, RotateCw, Move } from 'lucide-react';
import { toast } from '@/app/components/Toast'

interface ModalFacturaProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  gastoData?: {
    proveedor?: string;
    fecha?: string;
    monto?: number;
    descripcion?: string;
  };
  ventaData?: {
    comprador?: string;
    fecha?: string;
    monto?: number;
  };
}

export default function ModalFactura({
  isOpen,
  onClose,
  imageUrl,
  gastoData,
  ventaData
}: ModalFacturaProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => setZoom(prev => Math.min(prev + 0.3, 4)), []);
  const handleZoomOut = useCallback(() => setZoom(prev => Math.max(prev - 0.3, 0.5)), []);
  const handleRotate = useCallback(() => setRotation(prev => (prev + 90) % 360), []);
  const handleResetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Effect for body overflow and reset on open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setImageLoaded(false);
      setPosition({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Effect for keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleZoomIn, handleZoomOut]);

  if (!isOpen) return null;

  // Pan handlers (these can stay as regular functions since they're only used in JSX)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsPanning(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y,
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      setStartPos({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanning || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - startPos.x,
      y: touch.clientY - startPos.y,
    });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `factura_${gastoData?.proveedor || ventaData?.comprador || Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando imagen:', error);
      toast.error('Error al descargar la imagen');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-2 sm:p-4 z-10">
        <div className="max-w-7xl mx-auto">
          {/* Mobile: stacked layout, Desktop: side by side */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            {/* Info de la factura */}
            <div className="text-white flex-1 min-w-0">
              <h3 className="text-sm sm:text-lg font-semibold flex items-center gap-1 sm:gap-2 truncate">
                📄 <span className="truncate">{ventaData ? 'Remito / Factura' : 'Factura Original'}</span>
              </h3>
              {gastoData && (
                <p className="text-xs sm:text-sm text-gray-300 mt-0.5 sm:mt-1 truncate">
                  {gastoData.proveedor && `${gastoData.proveedor} • `}
                  {gastoData.fecha && `${new Date(gastoData.fecha).toLocaleDateString('es-UY')} • `}
                  {gastoData.monto && `$${gastoData.monto.toFixed(2)}`}
                </p>
              )}
              {ventaData && (
                <p className="text-xs sm:text-sm text-gray-300 mt-0.5 sm:mt-1 truncate">
                  {ventaData.comprador && `${ventaData.comprador} • `}
                  {ventaData.fecha && `${new Date(ventaData.fecha).toLocaleDateString('es-UY')} • `}
                  {ventaData.monto && `USD $${ventaData.monto.toFixed(2)}`}
                </p>
              )}
            </div>

            {/* Controles */}
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
              {/* Zoom Out */}
              <button
                onClick={handleZoomOut}
                className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-200 backdrop-blur-sm"
                title="Alejar (tecla -)"
              >
                <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Indicador de zoom */}
              <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/10 rounded-lg text-white font-medium min-w-[50px] sm:min-w-[70px] text-center backdrop-blur-sm text-xs sm:text-sm">
                {Math.round(zoom * 100)}%
              </div>

              {/* Zoom In */}
              <button
                onClick={handleZoomIn}
                className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-200 backdrop-blur-sm"
                title="Acercar (tecla +)"
              >
                <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Rotar */}
              <button
                onClick={handleRotate}
                className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-200 backdrop-blur-sm"
                title="Rotar 90°"
              >
                <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Centrar / Reset */}
              <button
                onClick={handleResetPosition}
                className="p-1.5 sm:p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-200 backdrop-blur-sm"
                title="Centrar imagen"
              >
                <Move className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Descargar */}
              <button
                onClick={handleDownload}
                className="p-1.5 sm:p-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-all duration-200"
                title="Descargar factura"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Cerrar */}
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-all duration-200"
                title="Cerrar (ESC)"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor de imagen con pan */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center p-2 sm:p-4 pt-20 sm:pt-24 pb-12 sm:pb-8 overflow-hidden select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <div className="relative">
          {/* Loading spinner */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
          )}

          {/* Imagen */}
          <img
            src={imageUrl}
            alt="Factura"
            className="max-w-none shadow-2xl rounded-lg pointer-events-none max-h-[70vh] sm:max-h-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              opacity: imageLoaded ? 1 : 0,
              transition: isPanning ? 'none' : 'transform 0.2s ease-out',
            }}
            onLoad={() => setImageLoaded(true)}
            draggable={false}
          />
        </div>
      </div>

      {/* Hint de atajos - oculto en móvil */}
      <div className="hidden sm:block absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-white text-xs">
        <span className="opacity-75">
          🖱️ Arrastrá para mover •
          <kbd className="px-2 py-1 bg-white/20 rounded ml-2">ESC</kbd> Cerrar •
          <kbd className="px-2 py-1 bg-white/20 rounded ml-2">+</kbd> Acercar •
          <kbd className="px-2 py-1 bg-white/20 rounded ml-2">-</kbd> Alejar
        </span>
      </div>

      {/* Hint móvil simplificado */}
      <div className="sm:hidden absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-[10px]">
        <span className="opacity-75">👆 Arrastrá para mover</span>
      </div>
    </div>
  );
}