import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { resetPasswordBodySchema } from "@/validators/authValidators";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { resetPassword } from "@/services/passwordResetService";

export async function POST(req: Request) {
  const parsed = resetPasswordBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request"), { status: 400 });
  }

  const { token, newPassword, recaptchaToken } = parsed.data;

  if (recaptchaToken) {
    const recaptcha = await verifyRecaptcha(recaptchaToken, "reset_password");
    if (!recaptcha.success) {
      return NextResponse.json(fail("RECAPTCHA_FAILED", "reCAPTCHA failed"), { status: 400 });
    }
  }

  const result = await resetPassword({ token, newPassword, req });
  if (!result.ok) {
    return NextResponse.json(fail("INVALID_TOKEN", "Reset token is invalid or expired"), {
      status: 400,
    });
  }

  return NextResponse.json(ok({}), { status: 200 });
}

