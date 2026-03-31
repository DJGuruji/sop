import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return `just now`;
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Automatically mark recent ones as read when viewed
  if (notifications.some(n => !n.isRead)) {
    await prisma.notification.updateMany({
       where: { userId: session.sub, isRead: false },
       data: { isRead: true }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Management</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Notifications</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your system and document alerts.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No notifications found.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n.id} className={`p-5 transition-colors ${n.isRead ? 'bg-white' : 'bg-slate-50'}`}>
                <div className="flex items-start gap-4">
                  <div className={`mt-1.5 flex h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-slate-300' : 'bg-blue-600'}`} />
                  <div className="flex-1 space-y-1">
                    {n.link ? (
                      <Link href={n.link} className="font-medium text-slate-900 hover:text-blue-600">
                        {n.title}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">{n.title}</p>
                    )}
                    <p className="text-sm text-slate-600">{n.message}</p>
                    <p className="text-xs text-slate-400 font-medium pt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
