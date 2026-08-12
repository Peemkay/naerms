import { requireSession } from "@/lib/session"
import { getDefaultOriginForFormation } from "@/lib/formation"
import { getDraftsForFormation, getDraftWithItems } from "@/lib/returns"
import { toIsoDate } from "@/lib/format"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DraftList } from "@/components/draft-list"
import { ReturnForm } from "./return-form"

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; draft?: string }>
}) {
  const session = await requireSession()
  const { ref, draft: draftId } = await searchParams
  const defaultOrigin = await getDefaultOriginForFormation(session.user.id)

  // Resuming a saved draft, if one was picked from the list below.
  const draft = draftId ? await getDraftWithItems(draftId, session.user.id) : null
  const drafts = await getDraftsForFormation(session.user.id)
  // The one being edited is already on screen, so don't offer it again.
  const otherDrafts = drafts.filter((d) => d.id !== draft?.id)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">{draft ? "Resume Draft" : "New Return"}</h1>
        <p className="text-sm text-muted-foreground">
          Submitting on behalf of {session.user.name}. Add as many equipment items as this
          request covers.
        </p>
      </div>

      {otherDrafts.length > 0 && (
        <DraftList
          drafts={otherDrafts.map((d) => ({
            id: d.id,
            requestRef: d.requestRef,
            itemCount: d._count.items,
            updatedAt: d.updatedAt.toISOString(),
          }))}
        />
      )}

      <Card>
        <CardHeader className="text-sm text-muted-foreground">
          Fields map to the Sigs returns register (Fmn/Unit is filled in automatically from
          your session).
        </CardHeader>
        <CardContent>
          <ReturnForm
            // Remounts the form when switching between drafts, so its state
            // (and its autosave key) starts from the newly loaded one rather
            // than keeping the previous draft's values on screen.
            key={draft?.id ?? "new"}
            mode="create"
            formationId={session.user.id}
            defaultOrigin={defaultOrigin}
            defaultRequestRef={ref}
            draftId={draft?.id}
            draftValues={draft ? { requestRef: draft.requestRef, auth: draft.auth ?? "" } : undefined}
            draftItems={draft?.items.map((item) => ({
              dateIssued: toIsoDate(item.dateIssued) ?? "",
              howDeployed: (item.howDeployed ?? "") as "",
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
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
