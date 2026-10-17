import { getDatabase } from '@/lib/db';

export interface AuditLogPayload {
  userId?: number | null;
  action: string;
  targetId?: string | number | null;
  ipAddress?: string | null;
  details?: Record<string, unknown> | string | null;
}

/**
 * Record an audit log entry for significant system actions (RBAC changes, reservations,
 * master data edits, logins, etc.)
 */
export function logAudit(payload: AuditLogPayload): void {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, target_id, ip_address, details)
      VALUES (?, ?, ?, ?, ?)
    `);

    const detailsStr = payload.details
      ? typeof payload.details === 'string'
        ? payload.details
        : JSON.stringify(payload.details)
      : null;

    stmt.run(
      payload.userId ?? null,
      payload.action,
      payload.targetId ? String(payload.targetId) : null,
      payload.ipAddress ?? null,
      detailsStr
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Retrieve recent audit logs with user information
 */
export function getRecentAuditLogs(limit = 50) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email, u.role as user_role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}
