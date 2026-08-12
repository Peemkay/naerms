import { AppShell } from "@/components/app-shell"
import { FormationTreeSidebar } from "@/components/formation-tree-sidebar"
import { NavTabs } from "@/components/nav-tabs"
import { requireSession } from "@/lib/session"
import { getVisibleFormationTree } from "@/lib/formation-tree"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const tree = await getVisibleFormationTree(session.user.id)
  // Mirrors the access gate on /dashboard/accounts itself — any one of the
  // three formation-related privileges earns the nav tab, not just the two
  // account-specific ones (a formation holding only MANAGE_FORMATIONS
  // couldn't otherwise reach the list where its own creations, or the new
  // delete-formation action, live).
  const canManageAccounts =
    session.user.privileges.includes("MANAGE_ACCOUNTS") ||
    session.user.privileges.includes("MANAGE_PRIVILEGES") ||
    session.user.privileges.includes("MANAGE_FORMATIONS")

  return (
    <AppShell
      nav={
        <NavTabs
          items={[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/dashboard/sheet", label: "Returns Sheet" },
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
