import { PrismaClient } from '@prisma/client';

// Eén gedeelde PrismaClient voor de hele server. Voorkomt overbodige
// connectie-pools én zorgt dat één $disconnect() alle DB-toegang sluit
// (o.a. vóór een database-restore). De globalThis-cache voorkomt meerdere
// instanties bij dev hot-reload (tsx watch).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
