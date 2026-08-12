import Link from "next/link"
import { notFound } from "next/navigation"
import { Pencil, Printer } from "lucide-react"

import { requireSession } from "@/lib/session"
import { getReturnWithItems } from "@/lib/returns"
import { getVisibleFormationIds } from "@/lib/scope"
import { prisma } from "@/lib/prisma"
import { RETURN_STATUS_LABEL, RETURN_STATUS_TONE, CONDITION_TONE } from "@/lib/status"
import { conditionBreakdownText, dominantCondition } from "@/lib/condition-breakdown"
import { StatusBadge } from "@/components/status-badge"
import { StatusTimeline } from "@/components/status-timeline"
import { StatusChangeForm } from "@/components/status-change-form"
import { DeleteReturnButton } from "@/components/delete-return-button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? <span className="text-muted-foreground">N/A</span>}</p>
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
  const canDelete = session.user.privileges.includes("DELETE_RETURNS") && visibleIds.includes(ret.formationId)

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/returns/${ret.id}/print`} target="_blank">
                <Printer className="size-3.5" />
                Preview &amp; Print
              </Link>
            }
          />
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
          {canDelete && <DeleteReturnButton returnId={ret.id} requestRef={ret.requestRef} />}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="text-sm font-medium">Register Details</CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Request Ref" value={ret.requestRef} />
          <Field label="Auth" value={ret.auth} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {ret.items.map((item) => {
          const tone = dominantCondition(item)
          return (
            <Card key={item.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    Item {item.lineNo} &middot; {item.equipmentName}
                  </p>
                  <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={RETURN_STATUS_TONE[item.status]}>
                    {RETURN_STATUS_LABEL[item.status]}
                  </StatusBadge>
                  {tone && (
                    <StatusBadge tone={CONDITION_TONE[tone]}>{conditionBreakdownText(item)}</StatusBadge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-3">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 lg:col-span-2">
                  <Field
                    label="Date Issued"
                    value={item.dateIssued?.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  />
                  <Field label="How Deployed" value={item.howDeployed} />
                  <Field label="Purpose of Issue" value={item.purposeOfIssue} />
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
          )
        })}
      </div>
    </div>
  )
}
