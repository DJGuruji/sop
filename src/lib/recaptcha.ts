const secret = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;
if (!secret) {
  // don't throw at import time because some scripts may not call recaptcha
}

type ReCaptchaResult = {
  success: boolean;
  score?: number;
  action?: string;
  [key: string]: unknown;
};

export async function verifyRecaptcha(token: string, action = "login") {
  if (!secret) {
    return { success: false, error: "MISSING_RECAPTCHA_SECRET" };
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });

  if (!response.ok) {
    return { success: false, error: "RECAPTCHA_SERVICE_ERROR" };
  }

  const data = (await response.json()) as ReCaptchaResult;
  if (!data.success) {
    return { success: false, error: "RECAPTCHA_FAILED", result: data };
  }
  if (data.action && data.action !== action) {
    return { success: false, error: "RECAPTCHA_ACTION_MISMATCH", result: data };
  }
  if (typeof data.score === "number" && data.score < 0.3) {
    return { success: false, error: "RECAPTCHA_LOW_SCORE", result: data };
  }

  return { success: true, result: data };
}

export function requiredEmailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith("@iiclakshya.com");
}
