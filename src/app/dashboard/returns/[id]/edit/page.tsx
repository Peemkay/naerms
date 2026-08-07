import { notFound, redirect } from "next/navigation"

import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { toIsoDate } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { ReturnForm } from "@/app/dashboard/new-return/return-form"
import type { ReturnFormInput, ReturnItemInput } from "@/lib/validation/return"

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

  const initialItems: ReturnItemInput[] = ret.items.map((item) => ({
    equipmentName: item.equipmentName,
    equipmentModel: item.equipmentModel ?? "",
    band: (item.band ?? "") as ReturnItemInput["band"],
    equipmentType: (item.equipmentType ?? "") as ReturnItemInput["equipmentType"],
    equipmentSerial: item.equipmentSerial,
    origin: item.origin ?? "",
    condition: item.condition ?? "",
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
              dateIssued: toIsoDate(ret.dateIssued) ?? "",
              howDeployed: (ret.howDeployed ?? "") as ReturnFormInput["howDeployed"],
              purposeOfIssue: ret.purposeOfIssue ?? "",
            }}
            initialItems={initialItems}
          />
        </CardContent>
      </Card>
    </div>
  )
}
