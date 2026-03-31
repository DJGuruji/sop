import { requiredEmailDomain, verifyRecaptcha } from "@/lib/recaptcha";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { forgotPasswordBodySchema } from "@/validators/authValidators";
import { requestPasswordReset } from "@/services/passwordResetService";

export async function POST(req: Request) {
  const parsed = forgotPasswordBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid request"), { status: 400 });
  }
  const { email, recaptchaToken } = parsed.data;

  const recaptcha = await verifyRecaptcha(recaptchaToken, "forgot_password");
  if (!recaptcha.success) {
    return NextResponse.json(fail("RECAPTCHA_FAILED", "reCAPTCHA failed"), { status: 400 });
  }

  if (!requiredEmailDomain(email)) {
    return NextResponse.json(
      fail("INVALID_EMAIL_DOMAIN", "Email must end with @iiclakshya.com"),
      { status: 400 },
    );
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  await requestPasswordReset({ email, baseUrl, req });

  // Always return success to avoid user enumeration.
  return NextResponse.json(ok({}), { status: 200 });
}
