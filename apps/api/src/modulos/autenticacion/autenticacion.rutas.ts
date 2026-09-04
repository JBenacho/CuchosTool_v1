// Autenticacion e identidad (CU-EC-013 registro, CU-EC-014 inicio de sesion, CU-SEC-009 internos).
// Reglas: contrasenas nunca se guardan en claro (bcrypt); JWT lleva sub + rol;
// los roles desconocidos se deniegan por defecto (Default Deny, RN-SEC).
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { clientes, usuarios } from '../../bd/esquema';
import {
  ESTADO_ACTIVO,
  LONGITUD_MINIMA_CONTRASENA,
  PATRON_CORREO,
  ROL_CLIENTE,
  RONDAS_BCRYPT,
} from '../../dominio/constantes';

type CuerpoRegistro = { correo: string; contrasena: string; nombre: string };
type CuerpoIngreso = { correo: string; contrasena: string };

/**
 * Normaliza un correo recibido del cliente (dato externo).
 * @param correo valor crudo del formulario.
 * @returns correo en minusculas y sin espacios, o cadena vacia si no es valido.
 */
function normalizarCorreo(correo: string): string {
  const valor = String(correo || '').trim().toLowerCase();
  return PATRON_CORREO.test(valor) ? valor : '';
}

export async function rutasAutenticacion(aplicacion: FastifyInstance): Promise<void> {
  aplicacion.post<{ Body: CuerpoRegistro }>('/autenticacion/registro', {
    schema: {
      tags: ['autenticacion'],
      summary: 'Registrar cliente E-Commerce',
      body: { type: 'object', required: ['correo', 'contrasena', 'nombre'], properties: { correo: { type: 'string' }, contrasena: { type: 'string' }, nombre: { type: 'string' } } },
    },
  }, async function (solicitud, respuesta) {
    const correo = normalizarCorreo(solicitud.body?.correo || '');
    const contrasena = String(solicitud.body?.contrasena || '');
    const nombre = String(solicitud.body?.nombre || '').trim();
    if (!correo) return respuesta.code(400).send({ error: 'correo_invalido' });
    if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) return respuesta.code(400).send({ error: 'contrasena_corta' });
    if (!nombre) return respuesta.code(400).send({ error: 'nombre_requerido' });

    const existente = await base.select().from(clientes).where(eq(clientes.correo, correo)).limit(1);
    if (existente[0]) return respuesta.code(409).send({ error: 'correo_ya_registrado' });

    const hashContrasena = await bcrypt.hash(contrasena, RONDAS_BCRYPT);
    const [cliente] = await base.insert(clientes).values({ correo: correo, hashContrasena: hashContrasena, nombre: nombre }).returning({ id: clientes.id, correo: clientes.correo, nombre: clientes.nombre });
    const token = (aplicacion as any).jwt.sign({ sub: String(cliente.id), rol: ROL_CLIENTE });
    return { data: { cliente: cliente, token: token } };
  });

  aplicacion.post<{ Body: CuerpoIngreso }>('/autenticacion/ingreso', {
    schema: {
      tags: ['autenticacion'],
      summary: 'Iniciar sesion de cliente',
      body: { type: 'object', required: ['correo', 'contrasena'], properties: { correo: { type: 'string' }, contrasena: { type: 'string' } } },
    },
  }, async function (solicitud, respuesta) {
    const correo = normalizarCorreo(solicitud.body?.correo || '');
    const contrasena = String(solicitud.body?.contrasena || '');
    const filas = await base.select().from(clientes).where(eq(clientes.correo, correo)).limit(1);
    const cliente = filas[0];
    if (!cliente) return respuesta.code(401).send({ error: 'credenciales_invalidas' });
    const contrasenaValida = await bcrypt.compare(contrasena, cliente.hashContrasena);
    if (!contrasenaValida) return respuesta.code(401).send({ error: 'credenciales_invalidas' });
    const token = (aplicacion as any).jwt.sign({ sub: String(cliente.id), rol: ROL_CLIENTE });
    return { data: { cliente: { id: cliente.id, correo: cliente.correo, nombre: cliente.nombre }, token: token } };
  });

  // Ingreso de usuarios internos (RBAC). El JWT incluye rol, zona y vendedor (ABAC).
  aplicacion.post<{ Body: CuerpoIngreso }>('/autenticacion/ingreso-interno', {
    schema: {
      tags: ['autenticacion'],
      summary: 'Iniciar sesion de usuario interno',
      body: { type: 'object', required: ['correo', 'contrasena'], properties: { correo: { type: 'string' }, contrasena: { type: 'string' } } },
    },
  }, async function (solicitud, respuesta) {
    const correo = normalizarCorreo(solicitud.body?.correo || '');
    const contrasena = String(solicitud.body?.contrasena || '');
    const filas = await base.select().from(usuarios).where(eq(usuarios.correo, correo)).limit(1);
    const usuario = filas[0];
    if (!usuario || usuario.estado !== ESTADO_ACTIVO) return respuesta.code(401).send({ error: 'credenciales_invalidas' });
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.hashContrasena);
    if (!contrasenaValida) return respuesta.code(401).send({ error: 'credenciales_invalidas' });
    const token = (aplicacion as any).jwt.sign({ sub: String(usuario.id), rol: usuario.rol, zonaId: usuario.zonaId, vendedorId: usuario.vendedorId });
    return { data: { usuario: { id: usuario.id, correo: usuario.correo, rol: usuario.rol, zonaId: usuario.zonaId, vendedorId: usuario.vendedorId }, token: token } };
  });
}
