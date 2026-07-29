import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export type DatabaseHealth = {
  provider: "postgresql";
  orm: "prisma";
  status: "configured" | "unavailable";
};

export function databaseHealth(): DatabaseHealth {
  return {
    provider: "postgresql",
    orm: "prisma",
    status: process.env.DATABASE_URL ? "configured" : "unavailable"
  };
}

export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  prisma ??= new PrismaClient();
  return prisma;
}
