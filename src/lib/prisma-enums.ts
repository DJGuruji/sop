export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  DEPARTMENT_ADMIN: "DEPARTMENT_ADMIN",
  SUPERVISOR: "SUPERVISOR",
  EMPLOYEE: "EMPLOYEE",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const DocumentType = {
  SOP: "SOP",
  POLICY: "POLICY",
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  DRAFT: "DRAFT",
  PENDING_DEPT_ADMIN_APPROVAL: "PENDING_DEPT_ADMIN_APPROVAL",
  DEPT_ADMIN_APPROVED: "DEPT_ADMIN_APPROVED",
  PENDING_ADMIN_APPROVAL: "PENDING_ADMIN_APPROVAL",
  ADMIN_APPROVED: "ADMIN_APPROVED",
  PUBLISHED: "PUBLISHED",
  UNPUBLISHED: "UNPUBLISHED",
  ARCHIVED: "ARCHIVED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ADMIN_REJECTED: "ADMIN_REJECTED",
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const ApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ESCALATED: "ESCALATED",
  CANCELLED: "CANCELLED",
} as const;

export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  SOFT_DELETE: "SOFT_DELETE",
  RESTORE: "RESTORE",
  SUBMIT_FOR_APPROVAL: "SUBMIT_FOR_APPROVAL",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  ESCALATE: "ESCALATE",
  PUBLISH: "PUBLISH",
  UNPUBLISH: "UNPUBLISH",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
