import { AppShell } from "@/components/app-shell"
import { FormationTreeSidebar } from "@/components/formation-tree-sidebar"
import { NavTabs } from "@/components/nav-tabs"
import { requireRole } from "@/lib/session"
import { getVisibleFormationTree } from "@/lib/formation-tree"
import { ADMIN_ROLES } from "@/lib/roles"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(ADMIN_ROLES)
  const tree = await getVisibleFormationTree(session.user.formationId)

  return (
    <AppShell
      nav={
        <NavTabs
          items={[
            { href: "/admin", label: "Dashboard" },
            { href: "/admin/users", label: "Users" },
          ]}
        />
      }
    >
      <div className="flex flex-1">
        <FormationTreeSidebar tree={tree} />
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </AppShell>
  )
}
