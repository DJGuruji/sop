import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "sop_session";

export type SessionPayload = {
  sub: string;
  role: string;
  departmentId?: string | null;
  subDepartmentId?: string | null;
};

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Missing NEXTAUTH_SECRET");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function readSessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as SessionPayload;
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await readSessionToken(token);
  } catch {
    return null;
  }
}

