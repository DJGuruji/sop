import { z } from "zod";

export const listDepartmentsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listSubDepartmentsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  departmentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createDepartmentBodySchema = z.object({
  name: z.string().min(2).max(100),
});

export const updateDepartmentBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(2).max(20).nullable().optional(),
});

export const createSubDepartmentBodySchema = z.object({
  departmentId: z.string().min(10),
  name: z.string().min(2).max(100),
});

export const updateSubDepartmentBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(2).max(20).nullable().optional(),
});
