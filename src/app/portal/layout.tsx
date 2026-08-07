import { AppShell } from "@/components/app-shell"
import { NavTabs } from "@/components/nav-tabs"
import { requireRole } from "@/lib/session"
import { PORTAL_ROLES } from "@/lib/roles"

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(PORTAL_ROLES)

  return (
    <AppShell
      nav={
        <NavTabs
          items={[
            { href: "/portal", label: "My Formation" },
            { href: "/portal/new", label: "New Return" },
          ]}
        />
      }
    >
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </AppShell>
  )
}
