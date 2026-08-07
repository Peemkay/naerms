import { notFound, redirect } from "next/navigation"

import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { toIsoDate } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { ReturnForm } from "@/app/portal/return-form"
import type { ReturnFormInput } from "@/lib/validation/return"

export default async function EditReturnPage({ params }: PageProps<"/portal/[id]/edit">) {
  const { id } = await params
  const session = await requireSession()
  const ret = await prisma.equipmentReturn.findUnique({ where: { id } })
  if (!ret) notFound()

  if (ret.formationId !== session.user.formationId) redirect("/portal")
  if (ret.status !== "PENDING") redirect(`/returns/${ret.id}`)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Edit Return</h1>
        <p className="text-sm text-muted-foreground">
          Serial #{ret.serialNo} &middot; {ret.equipmentName}
        </p>
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
              howDeployed: ret.howDeployed as ReturnFormInput["howDeployed"],
              purposeOfIssue: ret.purposeOfIssue ?? "",
              equipmentName: ret.equipmentName,
              equipmentModel: ret.equipmentModel ?? "",
              band: ret.band as ReturnFormInput["band"],
              equipmentType: ret.equipmentType as ReturnFormInput["equipmentType"],
              equipmentSerial: ret.equipmentSerial,
              origin: ret.origin ?? "",
              condition: ret.condition ?? undefined,
              remarks: ret.remarks ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
