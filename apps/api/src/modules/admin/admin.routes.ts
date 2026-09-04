import type { FastifyInstance } from 'fastify';
import { desc } from 'drizzle-orm';
import { db } from '../../db/db';
import { customers, orders, auditLogs } from '../../db/schema';
import { recordAudit } from './audit';

// Consola administrativa (RBAC/ABAC + Default Deny, BL-019, CU-SEC-001..015 base).
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const requireRole = (app as any).requireRole as (roles: string[]) => any;

  app.get('/admin/customers', {
    preHandler: requireRole(['ADMIN']),
    schema: { tags: ['admin'], summary: 'Listar clientes (ADMIN)' },
  }, async (req) => {
    await recordAudit(req, 'admin.customers.list', 'customers', 'all', 'ok');
    const rows = await db.select({ id: customers.id, email: customers.email, name: customers.name, status: customers.status }).from(customers);
    return { data: rows };
  });

  app.get('/admin/orders', {
    preHandler: requireRole(['ADMIN', 'ZONAL_MANAGER']),
    schema: { tags: ['admin'], summary: 'Listar pedidos (ADMIN / ZONAL_MANAGER)' },
  }, async (req) => {
    await recordAudit(req, 'admin.orders.list', 'orders', 'all', 'ok');
    const rows = await db.select({ id: orders.id, orderRef: orders.orderRef, customerId: orders.customerId, status: orders.status, totalCents: orders.totalCents, createdAt: orders.createdAt }).from(orders).orderBy(desc(orders.id));
    return { data: rows };
  });

  app.get('/admin/audit', {
    preHandler: requireRole(['ADMIN', 'AUDITOR']),
    schema: { tags: ['admin'], summary: 'Consultar auditoria de operaciones (ADMIN / AUDITOR)' },
  }, async (req) => {
    await recordAudit(req, 'admin.audit.list', 'audit_logs', 'all', 'ok');
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(200);
    return { data: rows };
  });
}
