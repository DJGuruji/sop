import { z } from "zod";
import { Role } from "@/generated/prisma/enums";

export const listUsersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createUserBodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.nativeEnum(Role),
  departmentId: z.string().min(10).nullable().optional(),
  adminDepartmentIds: z.array(z.string().min(10)).max(100).optional(),
  subDepartmentId: z.string().min(10).nullable().optional(),
  reportingToId: z.string().min(10).nullable().optional(),
});

export const updateUserStatusBodySchema = z.object({
  isActive: z.boolean(),
});

const emptyToUndefined = (v: unknown) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
};

export const updateUserBodySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(254).optional(),
  password: z.preprocess(emptyToUndefined, z.string().min(8).max(72).optional()),
  role: z.nativeEnum(Role).optional(),
  departmentId: z.string().min(10).nullable().optional(),
  adminDepartmentIds: z.array(z.string().min(10)).max(100).optional(),
  subDepartmentId: z.string().min(10).nullable().optional(),
  reportingToId: z.string().min(10).nullable().optional(),
});

