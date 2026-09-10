// Pruebas unitarias del mapeo de topicos del publicador (sin base de datos).
import { describe, it, expect } from 'vitest';
import { topicoDeEvento } from '../src/modulos/eventos/buzon.servicio';

describe('topicoDeEvento', function () {
  it('eventos de pedido van al topico pedidos', function () {
    expect(topicoDeEvento('com.cuchostool.pedido.creado')).toBe('pedidos');
    expect(topicoDeEvento('com.cuchostool.pedido.pagado')).toBe('pedidos');
  });

  it('inventario, facturacion y comercial tienen topico propio (F5-GCP)', function () {
    expect(topicoDeEvento('com.cuchostool.inventario.stock_actualizado')).toBe('inventario');
    expect(topicoDeEvento('com.cuchostool.factura.emitida')).toBe('facturacion');
    expect(topicoDeEvento('com.cuchostool.ventab2b.creada')).toBe('comercial');
  });

  it('eventos de dominios desconocidos van al topico general', function () {
    expect(topicoDeEvento('com.cuchostool.otro.evento')).toBe('general');
  });
});