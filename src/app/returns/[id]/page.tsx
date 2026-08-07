import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"

import { requireSession } from "@/lib/session"
import { getReturnWithHistory } from "@/lib/returns"
import { getVisibleFormationIds } from "@/lib/scope"
import { canChangeStatus, homeRouteForRole } from "@/lib/roles"
import { CONDITION_LABEL, CONDITION_TONE, RETURN_STATUS_LABEL, RETURN_STATUS_TONE } from "@/lib/status"
import { AppShell } from "@/components/app-shell"
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

export default async function ReturnDetailPage({ params }: PageProps<"/returns/[id]">) {
  const { id } = await params
  const session = await requireSession()
  const ret = await getReturnWithHistory(id)
  if (!ret) notFound()

  const visibleIds = await getVisibleFormationIds(session.user.formationId)
  if (!visibleIds.includes(ret.formationId)) notFound()

  const canEdit = ret.formationId === session.user.formationId && ret.status === "PENDING"
  const canVerify = canChangeStatus(session.user.role) && visibleIds.includes(ret.formationId)
  const backHref = homeRouteForRole(session.user.role)

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">
              Serial #{ret.serialNo} &middot; {ret.equipmentName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ret.formation.name} &middot; Submitted by{" "}
              {ret.submittedBy.rank ? `${ret.submittedBy.rank} ` : ""}
              {ret.submittedBy.fullName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={RETURN_STATUS_TONE[ret.status]}>
              {RETURN_STATUS_LABEL[ret.status]}
            </StatusBadge>
            {ret.condition && (
              <StatusBadge tone={CONDITION_TONE[ret.condition]}>
                {CONDITION_LABEL[ret.condition]}
              </StatusBadge>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link href={`/portal/${ret.id}/edit`}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Link>
                }
              />
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card>
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
                <Field label="Origin" value={ret.origin} />
                <Field label="Equipment Model" value={ret.equipmentModel} />
                <Field label="Band" value={ret.band} />
                <Field label="Equipment Type" value={ret.equipmentType} />
                <Field label="Equipment Serial" value={ret.equipmentSerial} />
                {ret.remarks && (
                  <div className="col-span-full">
                    <Field label="Remarks" value={ret.remarks} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-sm font-medium">Audit Trail</CardHeader>
              <CardContent>
                <StatusTimeline entries={ret.statusHistory} />
              </CardContent>
            </Card>
          </div>

          {canVerify && (
            <div>
              <Card>
                <CardHeader className="text-sm font-medium">Change Status</CardHeader>
                <CardContent>
                  <StatusChangeForm returnId={ret.id} currentStatus={ret.status} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
