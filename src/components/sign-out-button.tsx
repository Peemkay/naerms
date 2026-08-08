import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { logoutAction } from "@/app/logout-action"

export function SignOutButton() {
  return (
    <form action={logoutAction}>
      <Button
        variant="ghost"
        size="icon"
        type="submit"
        aria-label="Sign out"
        className="text-white hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-4" />
      </Button>
    </form>
  )
}
