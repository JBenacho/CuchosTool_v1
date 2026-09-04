import { db } from '../../db/db';
import { auditLogs } from '../../db/schema';

// Registro de auditoria (CU-SEC-014/015). Acciones sensibles quedan trazadas.
export async function recordAudit(
  req: any,
  action: string,
  resource: string,
  resourceId: string | null,
  result: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: req && req.user && req.user.sub ? String(req.user.sub) : null,
    actorRole: req && req.user && req.user.role ? String(req.user.role) : null,
    action: action,
    resource: resource,
    resourceId: resourceId,
    result: result,
    metadata: metadata || null,
    ip: req && req.ip ? String(req.ip) : null,
  });
}
