import { notFound, redirect } from "next/navigation"

import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { toIsoDate } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { ReturnForm } from "@/app/dashboard/new-return/return-form"
import type { ReturnItemDraft } from "@/lib/validation/return"

export default async function EditReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const ret = await prisma.return.findUnique({
    where: { id },
    include: { items: { orderBy: { lineNo: "asc" } } },
  })
  if (!ret) notFound()

  if (ret.formationId !== session.user.id) redirect("/dashboard")
  if (ret.items.some((item) => item.status !== "PENDING")) redirect(`/dashboard/returns/${ret.id}`)

  const initialItems: ReturnItemDraft[] = ret.items.map((item) => ({
    dateIssued: toIsoDate(item.dateIssued) ?? "",
    howDeployed: (item.howDeployed ?? "") as ReturnItemDraft["howDeployed"],
    purposeOfIssue: item.purposeOfIssue ?? "",
    equipmentName: item.equipmentName,
    equipmentModel: item.equipmentModel ?? "",
    band: item.band ?? "",
    equipmentType: item.equipmentType ?? "",
    origin: item.origin ?? "",
    quantity: item.quantity,
    serviceableQty: item.serviceableQty,
    unserviceableQty: item.unserviceableQty,
    underRepairQty: item.underRepairQty,
    awaitingEvacuationQty: item.awaitingEvacuationQty,
    remarks: item.remarks ?? "",
  }))

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Edit Return</h1>
        <p className="text-sm text-muted-foreground">Request {ret.requestRef}</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <ReturnForm
            mode="edit"
            returnId={ret.id}
            initialValues={{
              requestRef: ret.requestRef,
              auth: ret.auth ?? "",
            }}
            initialItems={initialItems}
          />
        </CardContent>
      </Card>
    </div>
  )
}
