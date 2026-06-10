import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@prisma/client";

export async function logAudit(
  tenantId: string,
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId ?? null,
        action,
        entityType,
        entityId,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}
