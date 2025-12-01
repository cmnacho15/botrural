// components/ventas/TablaVentas.tsx
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TablaVentasProps {
  ventas: any[];
}

export default function TablaVentas({ ventas }: TablaVentasProps) {
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

  if (ventas.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No hay ventas registradas en este período</p>
      </div>
    );
  }

  // Agrupar por especie para mostrar por bloques
  const ventasBovino = ventas.filter(v => v.tipoAnimal === 'BOVINO');
  const ventasOvino = ventas.filter(v => v.tipoAnimal === 'OVINO');
  const ventasOtros = ventas.filter(v => !v.tipoAnimal || (v.tipoAnimal !== 'BOVINO' && v.tipoAnimal !== 'OVINO'));

  const TablaDetalle = ({ titulo, ventas, color }: any) => {
    if (ventas.length === 0) return null;

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className={`${color} text-white px-4 py-3`}>
          <h3 className="font-bold text-lg">{titulo}</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold">Fecha venta</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Comprador</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Vencimiento</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Categoría</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">nº anim</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">Precio</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">Peso/animal</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">Precio/animal</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">Peso lote</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">U$S Bruto</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">U$S Neto</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((venta: any) => {
                const pesoPromedio = venta.pesoLoteKg && venta.cantidadVendida 
                  ? venta.pesoLoteKg / venta.cantidadVendida 
                  : 0;
                const precioCabeza = venta.montoBrutoUSD && venta.cantidadVendida
                  ? venta.montoBrutoUSD / venta.cantidadVendida
                  : 0;

                return (
                  <tr key={venta.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">
                      {format(new Date(venta.fecha), 'dd/MM/yy', { locale: es })}
                    </td>
                    <td className="px-4 py-2 text-sm">{venta.comprador || '-'}</td>
                    <td className="px-4 py-2 text-sm">
                      {venta.fechaVencimiento 
                        ? format(new Date(venta.fechaVencimiento), 'dd/MM/yy', { locale: es })
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-2 text-sm">{venta.categoria || '-'}</td>
                    <td className="px-4 py-2 text-right text-sm">{venta.cantidadVendida || 0}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {venta.precioKgUSD ? formatNumber(venta.precioKgUSD, 2) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-sm">
                      {pesoPromedio ? formatNumber(pesoPromedio, 0) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-sm">
                      {precioCabeza ? formatNumber(precioCabeza, 0) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium">
                      {venta.pesoLoteKg ? formatNumber(venta.pesoLoteKg, 0) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium">
                      {venta.montoBrutoUSD ? formatCurrency(venta.montoBrutoUSD) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-green-700">
                      {venta.montoNetoUSD ? formatCurrency(venta.montoNetoUSD) : formatCurrency(venta.montoBrutoUSD || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            
            {/* Totales por bloque */}
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td colSpan={4} className="px-4 py-3">Totales</td>
                <td className="px-4 py-3 text-right">
                  {ventas.reduce((sum, v) => sum + (v.cantidadVendida || 0), 0)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(
                    ventas.reduce((sum, v) => sum + (v.montoBrutoUSD || 0), 0) / 
                    ventas.reduce((sum, v) => sum + (v.pesoLoteKg || 0), 0),
                    2
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(
                    ventas.reduce((sum, v) => sum + (v.pesoLoteKg || 0), 0) /
                    ventas.reduce((sum, v) => sum + (v.cantidadVendida || 0), 0),
                    0
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(
                    ventas.reduce((sum, v) => sum + (v.montoBrutoUSD || 0), 0) /
                    ventas.reduce((sum, v) => sum + (v.cantidadVendida || 0), 0),
                    0
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(ventas.reduce((sum, v) => sum + (v.pesoLoteKg || 0), 0), 0)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(ventas.reduce((sum, v) => sum + (v.montoBrutoUSD || 0), 0))}
                </td>
                <td className="px-4 py-3 text-right text-green-700">
                  {formatCurrency(ventas.reduce((sum, v) => sum + (v.montoNetoUSD || v.montoBrutoUSD || 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Detalle de Ventas</h2>
      
      <TablaDetalle titulo="VACUNOS" ventas={ventasBovino} color="bg-green-600" />
      <TablaDetalle titulo="OVINOS" ventas={ventasOvino} color="bg-green-600" />
      {ventasOtros.length > 0 && (
        <TablaDetalle titulo="OTROS" ventas={ventasOtros} color="bg-gray-600" />
      )}
    </div>
  );
}