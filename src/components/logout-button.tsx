"use client";

export function LogoutButton() {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-md bg-red-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Logout
    </button>
  );
}
