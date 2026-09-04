import { describe, it, expect } from 'vitest';
import { computeTotals } from '../src/modules/orders/order.service';

// Pruebas unitarias del calculo de totales (sin DB).
describe('computeTotals', function () {
  it('suma subtotal con precios de catalogo', function () {
    const r = computeTotals([{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }], function (id) { return id === 1 ? 14500000 : id === 2 ? 3800000 : undefined; });
    expect(r.subtotal).toBe(32800000);
    expect(r.shipping).toBe(0);
    expect(r.total).toBe(32800000);
  });

  it('precio ausente aporta 0', function () {
    const r = computeTotals([{ productId: 9, quantity: 3 }], function () { return undefined; });
    expect(r.total).toBe(0);
  });
});
