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
            ...(canManageAccounts ? [{ href: "/dashboard/accounts", label: "Accounts" }] : []),
          ]}
        />
      }
    >
      {/* Column below lg (drawer toggle bar, then content full-width) — a
          permanent side-by-side row left almost no room for content on a
          phone-width screen. */}
      <div className="flex flex-1 flex-col lg:flex-row">
        <FormationTreeSidebar
          tree={tree}
          canAddFormation={session.user.privileges.includes("MANAGE_FORMATIONS")}
        />
        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </AppShell>
  )
}
