// Audit log (GDD Phase 5 anti-abuse): security-relevant events, written without blocking requests.

import type { Db } from './db/client.js';
import { auditLog } from './db/schema.js';

export type AuditKind =
  | 'register'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'rate_limited'
  | 'ws_abuse'
  | 'match_forfeit'
  | 'craft'
  | 'forge'
  | 'split'
  | 'salvage';

export function audit(db: Db, kind: AuditKind, e: { userId?: string | null; detail?: Record<string, unknown>; ip?: string } = {}): void {
  db.insert(auditLog)
    .values({ kind, userId: e.userId ?? null, detail: e.detail ?? {}, ip: e.ip ?? null })
    .catch(() => {
      /* auditing must never break the request */
    });
}
