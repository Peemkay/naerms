import { AppShell } from "@/components/app-shell"
import { FormationTreeSidebar } from "@/components/formation-tree-sidebar"
import { NavTabs } from "@/components/nav-tabs"
import { requireSession } from "@/lib/session"
import { getVisibleFormationTree } from "@/lib/formation-tree"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const tree = await getVisibleFormationTree(session.user.id)
  const canManageAccounts =
    session.user.privileges.includes("MANAGE_ACCOUNTS") ||
    session.user.privileges.includes("MANAGE_PRIVILEGES")

  return (
    <AppShell
      nav={
        <NavTabs
          items={[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/dashboard/new-return", label: "New Return" },
            // Every formation can request returns from formations under it,
            // same as the inline button on a formation's own overview page —
            // this is just a direct, always-available entry point that lets
            // you pick any formation in your tree rather than only the one
            // you happen to be viewing.
            { href: "/dashboard/request-returns", label: "Request Returns" },
            ...(canManageAccounts ? [{ href: "/dashboard/accounts", label: "Accounts" }] : []),
          ]}
        />
      }
    >
      <div className="flex flex-1">
        <FormationTreeSidebar
          tree={tree}
          canAddFormation={session.user.privileges.includes("MANAGE_FORMATIONS")}
        />
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </AppShell>
  )
}
