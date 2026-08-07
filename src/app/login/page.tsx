import { Radio } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-11 items-center justify-center rounded-lg border border-border bg-primary text-primary-foreground">
            <Radio className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-wide">NAERMS</h1>
            <p className="text-sm text-muted-foreground">
              Nigerian Army Signals Equipment Returns Management System
            </p>
          </div>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-0">
            <p className="text-sm font-medium text-foreground">Sign in</p>
            <p className="text-sm text-muted-foreground">
              Sign in with your formation&apos;s NAWANI email to access its returns.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <LoginForm />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Restricted system. Access is logged and limited to authorised personnel.
        </p>
      </div>
    </main>
  )
}
