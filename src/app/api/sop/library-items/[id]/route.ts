import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import {
  deleteManagedSopLibraryItem,
  getManagedSopLibraryItemForViewer,
  updateManagedSopLibraryItem,
} from "@/services/sopLibraryService";

const ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_ADMIN];
const VIEW_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_ADMIN, Role.SUPERVISOR];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(VIEW_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const result = await getManagedSopLibraryItemForViewer(auth.actor, id);
  if (!result.ok) {
    const status = result.message === "Document not found" ? 404 : 403;
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status });
  }

  return NextResponse.json(ok({ item: result.item }), { status: 200 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    version?: string;
    effectiveDate?: string;
    editableHtml?: string;
  };
  const { id } = await ctx.params;
  const result = await updateManagedSopLibraryItem(
    auth.actor,
    id,
    {
      title: typeof body.title === "string" ? body.title : "",
      effectiveDate: typeof body.effectiveDate === "string" ? body.effectiveDate : "",
      editableHtml: typeof body.editableHtml === "string" ? body.editableHtml : "",
    },
    req,
  );

  if (!result.ok) {
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status: 400 });
  }

  return NextResponse.json(ok({ saved: true }), { status: 200 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor(ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail(auth.code, auth.code === "UNAUTHORIZED" ? "Not authenticated" : "Forbidden"), {
      status: auth.code === "UNAUTHORIZED" ? 401 : 403,
    });
  }

  const { id } = await ctx.params;
  const result = await deleteManagedSopLibraryItem(auth.actor, id, req);
  if (!result.ok) {
    return NextResponse.json(fail("VALIDATION_ERROR", result.message), { status: 400 });
  }

  return NextResponse.json(ok({ deleted: true }), { status: 200 });
}
