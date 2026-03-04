import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAudit(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entity: string,
  entityId: number,
  changes: Record<string, unknown>,
  performedBy: string = 'admin'
) {
  await prisma.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      changes: JSON.stringify(changes),
      performedBy,
    },
  });
}
