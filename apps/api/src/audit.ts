import { prisma } from './core';
import type { AuditEntity, AuditAction } from '@prisma/client';

type AuditInput = {
  entity: AuditEntity;
  entityId: number;
  action: AuditAction;
  detail?: string | null;
  userId?: number | null;
  userKind?: string | null;
};

export const logAudit = async (input: AuditInput) => {
  try {
    await prisma.auditLog.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        detail: input.detail ?? null,
        userId: input.userId ?? null,
        userKind: input.userKind ?? null
      }
    });
  } catch (error) {
    // audit must never break the main flow
    // eslint-disable-next-line no-console
    console.warn('[audit] failed to record entry', error);
  }
};
