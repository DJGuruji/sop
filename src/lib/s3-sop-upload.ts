import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const SOP_PREFIX = "sop/";

export type S3SopEnv = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Optional: CloudFront or custom origin, e.g. https://cdn.example.com (no trailing slash) */
  publicBaseUrl: string | null;
};

export function getS3SopEnv(): S3SopEnv | null {
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || null;

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return { region, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

let cachedClient: S3Client | null = null;
let cachedForKey: string | null = null;

function getS3Client(env: S3SopEnv): S3Client {
  const key = `${env.region}:${env.accessKeyId.slice(0, 4)}`;
  if (!cachedClient || cachedForKey !== key) {
    cachedClient = new S3Client({
      region: env.region,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    });
    cachedForKey = key;
  }
  return cachedClient;
}

function encodeS3ObjectKeyInUrlPath(key: string): string {
  return key
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/** Public URL for the object (bucket policy or CloudFront must allow reads if used in browser). */
export function publicUrlForSopObject(env: S3SopEnv, key: string): string {
  const pathPart = encodeS3ObjectKeyInUrlPath(key);
  if (env.publicBaseUrl) {
    return `${env.publicBaseUrl}/${pathPart}`;
  }
  return `https://${env.bucket}.s3.${env.region}.amazonaws.com/${pathPart}`;
}

export async function uploadSopFileToS3(params: {
  buffer: Buffer;
  /** Filename only (e.g. slug); key will be `sop/${fileName}` */
  fileName: string;
  contentType: string;
}): Promise<{ key: string; publicUrl: string }> {
  const env = getS3SopEnv();
  if (!env) {
    throw new Error("S3 is not configured (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET)");
  }

  const safeName = params.fileName.replace(/^\/+/, "").replace(/\.\./g, "");
  const key = `${SOP_PREFIX}${safeName}`;

  const client = getS3Client(env);
  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
    }),
  );

  return { key, publicUrl: publicUrlForSopObject(env, key) };
}

/**
 * Resolve S3 object key from a public URL we generated, or null if not this bucket / not S3.
 */
export function resolveSopS3KeyFromPublicUrl(url: string, env: S3SopEnv): string | null {
  const trimmed = url.split("?")[0]?.trim() ?? "";
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }

  try {
    if (env.publicBaseUrl && trimmed.startsWith(env.publicBaseUrl)) {
      const rest = trimmed.slice(env.publicBaseUrl.length).replace(/^\//, "");
      if (!rest || rest.includes("..")) return null;
      return rest.split("/").map((s) => decodeURIComponent(s)).join("/");
    }

    const u = new URL(trimmed);
    const virtualHost = `${env.bucket}.s3.${env.region}.amazonaws.com`;
    const virtualHostLegacy = `${env.bucket}.s3.amazonaws.com`;

    if (u.hostname === virtualHost || u.hostname === virtualHostLegacy) {
      const key = u.pathname.replace(/^\//, "");
      if (!key || key.includes("..")) return null;
      return key.split("/").map((s) => decodeURIComponent(s)).join("/");
    }

    // Path-style: s3.<region>.amazonaws.com/<bucket>/<key>
    if (u.hostname === `s3.${env.region}.amazonaws.com` || u.hostname === "s3.amazonaws.com") {
      const parts = u.pathname.replace(/^\//, "").split("/").filter(Boolean);
      if (parts[0] !== env.bucket) return null;
      const key = parts.slice(1).join("/");
      if (!key || key.includes("..")) return null;
      return key.split("/").map((s) => decodeURIComponent(s)).join("/");
    }

    return null;
  } catch {
    return null;
  }
}

/** Delete one object by public URL; no-op if URL is not mapped to this bucket. */
export async function deleteSopObjectByPublicUrl(
  url: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const env = getS3SopEnv();
  if (!env) {
    return { ok: false, message: "S3 is not configured" };
  }

  const key = resolveSopS3KeyFromPublicUrl(url, env);
  if (!key) {
    return { ok: false, message: "URL does not match configured S3 bucket or CDN" };
  }

  if (!key.startsWith(SOP_PREFIX)) {
    return { ok: false, message: "Refusing to delete object outside the sop/ prefix" };
  }

  try {
    const client = getS3Client(env);
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.bucket,
        Key: key,
      }),
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "S3 delete failed";
    console.error("[s3] DeleteObject failed:", key, e);
    return { ok: false, message: msg };
  }
}

/** Remove S3 objects for stored `sourceFileUrl` values (unique). Skips non-HTTPS and non-bucket URLs. */
export async function deleteSopFilesFromStorageForUrls(
  urls: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const unique = [...new Set(urls.map((u) => u.split("?")[0]?.trim() ?? "").filter(Boolean))];
  const env = getS3SopEnv();

  for (const url of unique) {
    if (!url.startsWith("https://")) continue;

    const needsS3 =
      url.includes(".amazonaws.com") ||
      (!!env?.publicBaseUrl && url.startsWith(env.publicBaseUrl));

    if (!needsS3) continue;

    if (!env) {
      return {
        ok: false,
        message: "S3 is not configured; cannot delete uploaded file from storage.",
      };
    }

    const key = resolveSopS3KeyFromPublicUrl(url, env);
    if (!key) {
      return { ok: false, message: "Could not resolve S3 object for this document file." };
    }

    const r = await deleteSopObjectByPublicUrl(url);
    if (!r.ok) return r;
  }

  return { ok: true };
}
