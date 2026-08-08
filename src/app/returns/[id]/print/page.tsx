import Image from "next/image"
import { notFound } from "next/navigation"

import { requireSession } from "@/lib/session"
import { getReturnWithItems } from "@/lib/returns"
import { getVisibleFormationIds } from "@/lib/scope"
import { prisma } from "@/lib/prisma"
import { RETURN_STATUS_LABEL } from "@/lib/status"
import { conditionBreakdownText } from "@/lib/condition-breakdown"
import { PrintButton } from "@/components/print-button"

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2">
      <span className="text-sm whitespace-nowrap text-neutral-600">{label}</span>
      <span className="flex-1 border-b border-neutral-900" />
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-neutral-500 uppercase">{label}</p>
      <p className="text-sm text-neutral-900">{value ?? "—"}</p>
    </div>
  )
}

const th = "border border-neutral-400 py-1.5 px-2 text-left align-bottom"
const td = "border border-neutral-300 py-1.5 px-2 align-top"

// Deliberately outside the /dashboard layout — no sidebar, no nav, no app
// chrome, and always rendered light (a printed record isn't themed).
// Any formation that can see this return (its own scope, or one it was
// notified about) can preview and print it — no privilege required.
export default async function PrintReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const ret = await getReturnWithItems(id)
  if (!ret) notFound()

  const visibleIds = await getVisibleFormationIds(session.user.id)
  const wasNotified = await prisma.notification.findFirst({
    where: { formationId: session.user.id, returnId: ret.id },
  })
  if (!visibleIds.includes(ret.formationId) && !wasNotified) notFound()

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-neutral-900 print:p-0">
      <style>{"@media print { @page { size: landscape; } }"}</style>

      <div className="mx-auto flex max-w-6xl justify-end pb-4 print:hidden">
        <PrintButton />
      </div>

      <div className="mx-auto max-w-6xl border border-neutral-300 p-8 print:border-0">
        <div className="mb-6 flex items-center justify-between border-b border-neutral-900 pb-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="NAERMS" width={44} height={50} className="h-11 w-auto" />
            <div>
              <p className="text-xs tracking-widest text-neutral-500 uppercase">
                Nigerian Army Signals
              </p>
              <h1 className="text-lg font-semibold">Equipment Return Register Entry</h1>
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Printed{" "}
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Request Ref" value={ret.requestRef} />
          <Field label="Fmn/Unit" value={ret.formation.name} />
          <Field label="Auth" value={ret.auth} />
        </div>

        <div className="mb-8 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="tracking-wide text-neutral-500 uppercase">
                <th className={th}>SER</th>
                <th className={th}>Date Issued</th>
                <th className={th}>How Deployed</th>
                <th className={th}>Purpose</th>
                <th className={th}>Equipment</th>
                <th className={th}>Model</th>
                <th className={th}>Band</th>
                <th className={th}>Type</th>
                <th className={th}>Origin</th>
                <th className={th}>Qty</th>
                <th className={th}>Condition</th>
                <th className={th}>Status</th>
                <th className={th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {ret.items.map((item) => (
                <tr key={item.id}>
                  <td className={td}>{item.lineNo}</td>
                  <td className={td}>
                    {item.dateIssued?.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }) ?? "—"}
                  </td>
                  <td className={td}>{item.howDeployed ?? "—"}</td>
                  <td className={td}>{item.purposeOfIssue ?? "—"}</td>
                  <td className={td}>{item.equipmentName}</td>
                  <td className={td}>{item.equipmentModel ?? "—"}</td>
                  <td className={td}>{item.band ?? "—"}</td>
                  <td className={td}>{item.equipmentType ?? "—"}</td>
                  <td className={td}>{item.origin ?? "—"}</td>
                  <td className={td}>{item.quantity}</td>
                  <td className={td}>{conditionBreakdownText(item)}</td>
                  <td className={td}>{RETURN_STATUS_LABEL[item.status]}</td>
                  <td className={td}>{item.remarks ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 border-t border-neutral-900 pt-6 sm:grid-cols-2">
          <SignatureLine label="Name / Rank" />
          <SignatureLine label="Signature / Date" />
        </div>
      </div>
    </main>
  )
}
