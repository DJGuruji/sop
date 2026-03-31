import ResetPasswordClient from "./reset-password-client";

type PageProps = {
  searchParams?: Promise<{ token?: string }> | { token?: string };
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const sp = await Promise.resolve(searchParams);
  const token = typeof sp?.token === "string" ? sp.token : "";
  return <ResetPasswordClient token={token} />;
}

