import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, RotateCw } from 'lucide-react';

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
}

export default function ModalFactura({
  isOpen,
  onClose,
  imageUrl,
  gastoData
}: ModalFacturaProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setImageLoaded(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.3, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.3, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  
  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `factura_${gastoData?.proveedor || Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando imagen:', error);
      alert('Error al descargar la imagen');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === '+' || e.key === '=') handleZoomIn();
    if (e.key === '-') handleZoomOut();
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Info de la factura */}
          <div className="text-white">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              📄 Factura Original
            </h3>
            {gastoData && (
              <p className="text-sm text-gray-300 mt-1">
                {gastoData.proveedor && `${gastoData.proveedor} • `}
                {gastoData.fecha && `${new Date(gastoData.fecha).toLocaleDateString('es-UY')} • `}
                {gastoData.monto && `$${gastoData.monto.toFixed(2)}`}
              </p>
            )}
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2">
            {/* Zoom Out */}
            <button
              onClick={handleZoomOut}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-200 backdrop-blur-sm"
              title="Alejar (tecla -)"
            >
              <ZoomOut size={20} />
            </button>

            {/* Indicador de zoom */}
            <div className="px-3 py-1.5 bg-white/10 rounded-lg text-white font-medium min-w-[70px] text-center backdrop-blur-sm">
              {Math.round(zoom * 100)}%
            </div>

            {/* Zoom In */}
            <button
              onClick={handleZoomIn}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-200 backdrop-blur-sm"
              title="Acercar (tecla +)"
            >
              <ZoomIn size={20} />
            </button>

            {/* Rotar */}
            <button
              onClick={handleRotate}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-200 backdrop-blur-sm"
              title="Rotar 90°"
            >
              <RotateCw size={20} />
            </button>

            {/* Descargar */}
            <button
              onClick={handleDownload}
              className="p-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-all duration-200"
              title="Descargar factura"
            >
              <Download size={20} />
            </button>

            {/* Cerrar */}
            <button
              onClick={onClose}
              className="p-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-all duration-200"
              title="Cerrar (ESC)"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Contenedor de imagen */}
      <div className="w-full h-full flex items-center justify-center p-4 pt-24 pb-8 overflow-auto">
        <div className="relative">
          {/* Loading spinner */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
          )}

          {/* Imagen */}
          <img
            src={imageUrl}
            alt="Factura"
            className="max-w-none shadow-2xl rounded-lg transition-all duration-300"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              opacity: imageLoaded ? 1 : 0,
            }}
            onLoad={() => setImageLoaded(true)}
            draggable={false}
          />
        </div>
      </div>

      {/* Hint de atajos */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-white text-xs">
        <span className="opacity-75">
          <kbd className="px-2 py-1 bg-white/20 rounded">ESC</kbd> Cerrar • 
          <kbd className="px-2 py-1 bg-white/20 rounded ml-2">+</kbd> Acercar • 
          <kbd className="px-2 py-1 bg-white/20 rounded ml-2">-</kbd> Alejar
        </span>
      </div>
    </div>
  );
}