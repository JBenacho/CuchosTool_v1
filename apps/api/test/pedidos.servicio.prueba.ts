// Pruebas unitarias de la logica critica de pedidos (sin base de datos).
import { describe, it, expect } from 'vitest';
import { calcularTotales } from '../src/modulos/pedidos/pedidos.servicio';

describe('calcularTotales', function () {
  it('suma subtotal con precios del catalogo', function () {
    const resultado = calcularTotales(
      [
        { productoId: 1, cantidad: 2 },
        { productoId: 2, cantidad: 1 },
      ],
      function (id) {
        return id === 1 ? 14500000 : id === 2 ? 3800000 : undefined;
      },
    );
    expect(resultado.subtotalCentavos).toBe(32800000);
    expect(resultado.envioCentavos).toBe(0);
    expect(resultado.totalCentavos).toBe(32800000);
  });

  it('precio ausente aporta 0 al total', function () {
    const resultado = calcularTotales([{ productoId: 9, cantidad: 3 }], function () {
      return undefined;
    });
    expect(resultado.totalCentavos).toBe(0);
  });
});
