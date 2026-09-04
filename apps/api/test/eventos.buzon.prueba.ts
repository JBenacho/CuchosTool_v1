// Pruebas unitarias del mapeo de topicos del publicador (sin base de datos).
import { describe, it, expect } from 'vitest';
import { topicoDeEvento } from '../src/modulos/eventos/buzon.servicio';

describe('topicoDeEvento', function () {
  it('eventos de pedido van al topico pedidos', function () {
    expect(topicoDeEvento('com.cuchostool.pedido.creado')).toBe('pedidos');
    expect(topicoDeEvento('com.cuchostool.pedido.pagado')).toBe('pedidos');
  });

  it('eventos de otros dominios van al topico general', function () {
    expect(topicoDeEvento('com.cuchostool.inventario.actualizado')).toBe('general');
  });
});
