// Pruebas unitarias de la orden de compra multi-linea con IVA por proveedor (CU-ERP-003).
// Cubre la validacion y los totales puros (sin BD) de la orden.
import { describe, it, expect } from 'vitest';
import {
  calcularTotalesOrden,
  normalizarLineasOrden,
  validarLineasOrden,
} from '../src/modulos/compras/compras.servicio';

const LINEAS = [
  { productoId: 1, cantidad: 10, precioUnitarioCentavos: 1000000 },
  { productoId: 2, cantidad: 4, precioUnitarioCentavos: 2500000 },
];

describe('validarLineasOrden (CU-ERP-003)', function () {
  it('acepta renglones con productos distintos y valores positivos', function () {
    expect(validarLineasOrden(LINEAS)).toBeNull();
  });

  it('exige al menos un renglon', function () {
    expect(validarLineasOrden([])).toBe('lineas_obligatorias');
  });

  it('rechaza productos repetidos en la misma orden', function () {
    expect(
      validarLineasOrden([
        { productoId: 1, cantidad: 1, precioUnitarioCentavos: 100 },
        { productoId: 1, cantidad: 2, precioUnitarioCentavos: 100 },
      ]),
    ).toBe('producto_duplicado_en_lineas');
  });

  it('rechaza cantidades y precios no positivos', function () {
    expect(validarLineasOrden([{ productoId: 1, cantidad: 0, precioUnitarioCentavos: 100 }])).toBe(
      'cantidad_invalida',
    );
    expect(validarLineasOrden([{ productoId: 1, cantidad: 1, precioUnitarioCentavos: 0 }])).toBe(
      'precio_invalido',
    );
  });
});

describe('calcularTotalesOrden (CU-ERP-003)', function () {
  it('suma unidades y aplica el IVA del proveedor sobre el subtotal', function () {
    const totales = calcularTotalesOrden(LINEAS, 1900);
    expect(totales.cantidadTotal).toBe(14);
    expect(totales.subtotalCentavos).toBe(20000000);
    expect(totales.impuestoCentavos).toBe(3800000);
    expect(totales.totalCentavos).toBe(23800000);
  });

  it('respeta una tarifa de IVA distinta por proveedor', function () {
    const totales = calcularTotalesOrden(LINEAS, 500);
    expect(totales.impuestoCentavos).toBe(1000000);
    expect(totales.totalCentavos).toBe(21000000);
  });

  it('no causa impuesto cuando el proveedor esta exento', function () {
    const totales = calcularTotalesOrden(LINEAS, 0);
    expect(totales.impuestoCentavos).toBe(0);
    expect(totales.totalCentavos).toBe(totales.subtotalCentavos);
  });

  it('redondea el IVA al centavo mas cercano', function () {
    const totales = calcularTotalesOrden(
      [{ productoId: 1, cantidad: 3, precioUnitarioCentavos: 333 }],
      1900,
    );
    expect(totales.subtotalCentavos).toBe(999);
    expect(totales.impuestoCentavos).toBe(190);
  });
});

describe('normalizarLineasOrden (CU-ERP-003)', function () {
  it('conserva los renglones del modo multi-linea', function () {
    expect(normalizarLineasOrden({ proveedorId: 1, bodegaDestinoId: 1, lineas: LINEAS })).toEqual(
      LINEAS,
    );
  });

  it('convierte el modo de una linea del MVP en un unico renglon', function () {
    expect(
      normalizarLineasOrden({
        proveedorId: 1,
        bodegaDestinoId: 1,
        productoId: 7,
        cantidad: 2,
        precioUnitarioCentavos: 5000,
      }),
    ).toEqual([{ productoId: 7, cantidad: 2, precioUnitarioCentavos: 5000 }]);
  });
});
