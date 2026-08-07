import Link from "next/link"
import { notFound } from "next/navigation"
import { Pencil } from "lucide-react"

import { requireSession } from "@/lib/session"
import { getReturnWithItems } from "@/lib/returns"
import { getVisibleFormationIds } from "@/lib/scope"
import { prisma } from "@/lib/prisma"
import { CONDITION_LABEL, CONDITION_TONE, RETURN_STATUS_LABEL, RETURN_STATUS_TONE } from "@/lib/status"
import { StatusBadge } from "@/components/status-badge"
import { StatusTimeline } from "@/components/status-timeline"
import { StatusChangeForm } from "@/components/status-change-form"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</p>
    </div>
  )
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const ret = await getReturnWithItems(id)
  if (!ret) notFound()

  const visibleIds = await getVisibleFormationIds(session.user.id)
  // Visibility is normally downward-only (self + subtree), but a return
  // fans out notifications downward from wherever it was submitted — so a
  // subordinate notified about a superior's request needs an exception to
  // actually open it, even though that formation isn't in their own subtree.
  const wasNotified = await prisma.notification.findFirst({
    where: { formationId: session.user.id, returnId: ret.id },
  })
  if (!visibleIds.includes(ret.formationId) && !wasNotified) notFound()

  const canEdit =
    ret.formationId === session.user.id && ret.items.every((item) => item.status === "PENDING")
  const canVerify = session.user.privileges.includes("VERIFY_RETURNS") && visibleIds.includes(ret.formationId)

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Request {ret.requestRef}</h1>
          <p className="text-sm text-muted-foreground">
            {ret.formation.name} &middot; {ret.items.length} equipment item
            {ret.items.length === 1 ? "" : "s"}
          </p>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/dashboard/returns/${ret.id}/edit`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            }
          />
        )}
      </div>

      <Card className="mb-6">
        <CardHeader className="text-sm font-medium">Register Details</CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Request Ref" value={ret.requestRef} />
          <Field label="Auth" value={ret.auth} />
          <Field
            label="Date Issued"
            value={ret.dateIssued?.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          />
          <Field label="How Deployed" value={ret.howDeployed} />
          <Field label="Purpose of Issue" value={ret.purposeOfIssue} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {ret.items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  Item {item.lineNo} &middot; {item.equipmentName}
                </p>
                <p className="text-xs text-muted-foreground">{item.equipmentSerial}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={RETURN_STATUS_TONE[item.status]}>
                  {RETURN_STATUS_LABEL[item.status]}
                </StatusBadge>
                {item.condition && (
                  <StatusBadge tone={CONDITION_TONE[item.condition]}>
                    {CONDITION_LABEL[item.condition]}
                  </StatusBadge>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:col-span-2">
                <Field label="Equipment Model" value={item.equipmentModel} />
                <Field label="Band" value={item.band} />
                <Field label="Equipment Type" value={item.equipmentType} />
                <Field label="Origin" value={item.origin} />
                {item.remarks && (
                  <div className="col-span-full">
                    <Field label="Remarks" value={item.remarks} />
                  </div>
                )}
                <div className="col-span-full border-t border-border pt-4">
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Audit Trail
                  </p>
                  <StatusTimeline entries={item.statusHistory} />
                </div>
              </div>
              {canVerify && (
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Change Status
                  </p>
                  <StatusChangeForm returnItemId={item.id} currentStatus={item.status} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
