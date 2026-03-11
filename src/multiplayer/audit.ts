import { MultiplayerRouteTarget } from './routes';

export type MultiplayerAuditEntity =
  | 'player'
  | 'pin'
  | 'collaboration'
  | 'proposal'
  | 'task'
  | 'message'
  | 'share'
  | 'ops'
  | 'system';

export type MultiplayerAuditSeverity = 'info' | 'attention' | 'critical';

export interface MultiplayerAuditEntry {
  id: string;
  ts: number;
  action: string;
  title: string;
  detail: string;
  actorId?: string;
  targetId?: string;
  entity: MultiplayerAuditEntity;
  severity: MultiplayerAuditSeverity;
  route?: MultiplayerRouteTarget;
}

interface CreateMultiplayerAuditEntryInput {
  action: string;
  title: string;
  detail: string;
  entity: MultiplayerAuditEntity;
  severity?: MultiplayerAuditSeverity;
  actorId?: string;
  targetId?: string;
  route?: MultiplayerRouteTarget;
}

export const createMultiplayerAuditEntry = ({
  action,
  title,
  detail,
  entity,
  severity = 'info',
  actorId,
  targetId,
  route,
}: CreateMultiplayerAuditEntryInput): MultiplayerAuditEntry => ({
  id: `mp-audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  ts: Date.now(),
  action,
  title,
  detail,
  entity,
  severity,
  actorId,
  targetId,
  route,
});
