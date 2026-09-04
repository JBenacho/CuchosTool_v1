import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../db/db';
import { customers } from '../../db/schema';

// Identidad de cliente E-Commerce (CU-EC-013 registrar / CU-EC-014 iniciar sesion).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegisterBody = { email: string; password: string; name: string };
type LoginBody = { email: string; password: string };

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RegisterBody }>('/auth/register', {
    schema: {
      tags: ['auth'],
      summary: 'Registrar cliente E-Commerce',
      body: { type: 'object', required: ['email', 'password', 'name'], properties: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' } } },
    },
  }, async (req, reply) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    if (!EMAIL_RE.test(email)) return reply.code(400).send({ error: 'email_invalido' });
    if (password.length < 8) return reply.code(400).send({ error: 'password_corta' });
    if (!name) return reply.code(400).send({ error: 'nombre_requerido' });
    const dup = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (dup[0]) return reply.code(409).send({ error: 'email_ya_registrado' });
    const hash = await bcrypt.hash(password, 10);
    const [c] = await db.insert(customers).values({ email: email, passwordHash: hash, name: name }).returning({ id: customers.id, email: customers.email, name: customers.name });
    const token = (app as any).jwt.sign({ sub: String(c.id), role: 'CUSTOMER' });
    return { data: { customer: c, token: token } };
  });

  app.post<{ Body: LoginBody }>('/auth/login', {
    schema: {
      tags: ['auth'],
      summary: 'Iniciar sesion de cliente',
      body: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
    },
  }, async (req, reply) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const row = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    const c = row[0];
    if (!c) return reply.code(401).send({ error: 'credenciales_invalidas' });
    const ok = await bcrypt.compare(password, c.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'credenciales_invalidas' });
    const token = (app as any).jwt.sign({ sub: String(c.id), role: 'CUSTOMER' });
    return { data: { customer: { id: c.id, email: c.email, name: c.name }, token: token } };
  });
}
