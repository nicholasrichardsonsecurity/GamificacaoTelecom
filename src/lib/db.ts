import { PrismaClient } from "@prisma/client";

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Client Prisma sem escopo de tenant. Para dados de negócio, use `dbDoTenant`. */
export const prisma = globalParaPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;
