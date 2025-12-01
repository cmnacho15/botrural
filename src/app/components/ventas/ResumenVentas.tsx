// components/ventas/ResumenVentas.tsx
interface ResumenVentasProps {
  resumen: {
    bovino: any;
    ovino: any;
    lana: any;
    totalGeneral: {
      animales: number;
      kgTotales: number;
      usdBruto: number;
      usdNeto: number;
    };
  };
}

export default function ResumenVentas({ resumen }: ResumenVentasProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 0) => {
    return new Intl.NumberFormat('es-UY', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  const TablaEspecie = ({ titulo, datos, color }: any) => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className={`${color} text-white px-4 py-3`}>
        <h3 className="font-bold text-lg">{titulo}</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-yellow-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold">Categoría</th>
              <th className="px-4 py-2 text-right text-sm font-semibold">Nº Animales</th>
              <th className="px-4 py-2 text-right text-sm font-semibold">U$/kg</th>
              <th className="px-4 py-2 text-right text-sm font-semibold">Peso (kg)</th>
              <th className="px-4 py-2 text-right text-sm font-semibold">U$S x cabeza</th>
              <th className="px-4 py-2 text-right text-sm font-semibold">kg TOTALES</th>
              <th className="px-4 py-2 text-right text-sm font-semibold">U$S totales bruto</th>
            </tr>
          </thead>
          <tbody>
            {datos.categorias.map((cat: any, idx: number) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 text-sm">{cat.categoria}</td>
                <td className="px-4 py-2 text-right text-sm">{cat.numAnimales}</td>
                <td className="px-4 py-2 text-right text-sm">{formatNumber(cat.precioKg, 2)}</td>
                <td className="px-4 py-2 text-right text-sm">{formatNumber(cat.pesoPromedio, 0)}</td>
                <td className="px-4 py-2 text-right text-sm">{formatNumber(cat.precioCabeza, 0)}</td>
                <td className="px-4 py-2 text-right text-sm font-medium">{formatNumber(cat.kgTotales, 0)}</td>
                <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(cat.usdBruto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 font-bold">
            <tr>
              <td className="px-4 py-3">TOTAL</td>
              <td className="px-4 py-3 text-right">{datos.total.animales}</td>
              <td className="px-4 py-3 text-right">{formatNumber(datos.total.precioKg, 2)}</td>
              <td className="px-4 py-3 text-right">{formatNumber(datos.total.pesoPromedio, 0)}</td>
              <td className="px-4 py-3 text-right">{formatNumber(datos.total.precioCabeza, 0)}</td>
              <td className="px-4 py-3 text-right">{formatNumber(datos.total.kgTotales, 0)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(datos.total.usdBruto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Resumen Bovinos */}
      {resumen.bovino.total.animales > 0 && (
        <TablaEspecie
          titulo="BOVINO"
          datos={resumen.bovino}
          color="bg-yellow-300"
        />
      )}

      {/* Resumen Ovinos */}
      {resumen.ovino.total.animales > 0 && (
        <TablaEspecie
          titulo="OVINO"
          datos={resumen.ovino}
          color="bg-yellow-300"
        />
      )}

      {/* Resumen Lana - Con tabla especial */}
      {resumen.lana.total.kgTotales > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-cyan-400 text-white px-4 py-3">
            <h3 className="font-bold text-lg">LANA</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-yellow-100">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Tipo</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Nº Animales</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">U$/kg</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Peso (kg/cabeza)</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">U$S x cabeza</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">kg TOTALES</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">U$S totales bruto</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">Lana</td>
                  <td className="px-4 py-2 text-right text-sm">{resumen.lana.total.animales}</td>
                  <td className="px-4 py-2 text-right text-sm">{formatNumber(resumen.lana.total.precioKg, 2)}</td>
                  <td className="px-4 py-2 text-right text-sm">{formatNumber(resumen.lana.total.pesoPromedio, 2)}</td>
                  <td className="px-4 py-2 text-right text-sm">{formatNumber(resumen.lana.total.precioCabeza, 2)}</td>
                  <td className="px-4 py-2 text-right text-sm font-medium">{formatNumber(resumen.lana.total.kgTotales, 0)}</td>
                  <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(resumen.lana.total.usdBruto)}</td>
                </tr>
              </tbody>
              <tfoot className="bg-gray-100 font-bold">
                <tr>
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right">{resumen.lana.total.animales}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(resumen.lana.total.precioKg, 2)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(resumen.lana.total.pesoPromedio, 2)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(resumen.lana.total.precioCabeza, 2)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(resumen.lana.total.kgTotales, 0)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(resumen.lana.total.usdBruto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Desglose Vellón/Barriga */}
          {resumen.lana.total.kgVellon > 0 && (
            <div className="p-4 bg-cyan-50 border-t">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">kg Vellón (90%):</span>
                  <span className="ml-2 font-medium">{formatNumber(resumen.lana.total.kgVellon, 1)}</span>
                </div>
                <div>
                  <span className="text-gray-600">kg Barriga (10%):</span>
                  <span className="ml-2 font-medium">{formatNumber(resumen.lana.total.kgBarriga, 1)}</span>
                </div>
                <div>
                  <span className="text-gray-600">kg Totales:</span>
                  <span className="ml-2 font-medium">{formatNumber(resumen.lana.total.kgTotales, 1)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Total General */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold text-xl mb-4">TOTAL GENERAL</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Total Animales</div>
            <div className="text-2xl font-bold">{resumen.totalGeneral.animales}</div>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Total kg</div>
            <div className="text-2xl font-bold">{formatNumber(resumen.totalGeneral.kgTotales, 0)}</div>
          </div>
          <div className="bg-green-100 p-4 rounded-lg">
            <div className="text-sm text-gray-600">U$S Bruto</div>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(resumen.totalGeneral.usdBruto)}</div>
          </div>
          <div className="bg-green-100 p-4 rounded-lg">
            <div className="text-sm text-gray-600">U$S Neto</div>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(resumen.totalGeneral.usdNeto)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}