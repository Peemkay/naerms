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
      <p className="text-sm text-neutral-900">{value ?? "N/A"}</p>
    </div>
  )
}

const th = "border border-neutral-400 py-0.5 px-1 text-left align-bottom break-words"
const td = "border border-neutral-300 py-0.5 px-1 align-top break-words"

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
      {/* Page numbers come from @page margin boxes: Chromium 131+ and
          Safari 18.2+ support them, Firefox ignores them entirely (bug
          1854974) and prints unnumbered. Declaring any margin box also
          suppresses the browser's own header/footer, which is what we
          want — the sheet carries only this centered number. */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
            @bottom-center {
              content: counter(page) "-" counter(pages);
              font-size: 8pt;
              color: #525252;
            }
          }
          /* Sheet 1 is bare "1"; every later sheet reads "2-10". */
          @page :first {
            @bottom-center { content: counter(page); }
          }
        }
      `}</style>

      <div className="mx-auto flex max-w-6xl justify-end pb-4 print:hidden">
        <PrintButton />
      </div>

      {/* p-8 is preview-only chrome: in print it would stack on top of the
          12mm @page margin and eat into the width the table is tuned for. */}
      <div className="mx-auto max-w-6xl border border-neutral-300 p-8 print:border-0 print:p-0">
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

        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Request Ref" value={ret.requestRef} />
          <Field label="Fmn/Unit" value={ret.formation.name} />
          <Field label="Auth" value={ret.auth} />
        </div>

        {/* No forced min-width — every column has to fit within the page/
            container at once (wrapping cell text as needed) rather than
            relying on horizontal scroll, which on a genuinely narrow
            preview viewport hid the right-most columns entirely.

            overflow-x-auto is preview-only and must be dropped for print: a
            scroll container clips to its visible box when paginating, which
            would print sheet 1 and silently swallow every row after it —
            exactly the multi-page case this layout exists to serve. */}
        <div className="mb-8 overflow-x-auto print:overflow-visible">
          <table className="w-full table-fixed border-collapse text-[9px]">
            {/* Explicit relative widths, not equal columns — table-fixed
                needs these to give Equipment/Condition/Remarks room to wrap
                sensibly instead of splitting every column evenly. Tuned for
                A4 portrait (~186mm inside the 12mm margins): Date and Status
                are held wide enough to keep "01 Jan 2026" and "Discrepancy"
                on one line, and Condition is the widest non-Remarks column
                because a full breakdown reads "3 Awaiting Evacuation, ...". */}
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[7%]" />
              <col className="w-[5%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[4%]" />
              <col className="w-[12%]" />
              <col className="w-[7%]" />
              <col className="w-[15%]" />
            </colgroup>
            {/* Portrait fits fewer rows per sheet, so multi-page prints are
                the norm now — repeat the header row on each one. */}
            <thead className="table-header-group">
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
                <tr key={item.id} className="break-inside-avoid">
                  <td className={td}>{item.lineNo}</td>
                  <td className={td}>
                    {item.dateIssued?.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }) ?? "N/A"}
                  </td>
                  <td className={td}>{item.howDeployed ?? "N/A"}</td>
                  <td className={td}>{item.purposeOfIssue ?? "N/A"}</td>
                  <td className={td}>{item.equipmentName}</td>
                  <td className={td}>{item.equipmentModel ?? "N/A"}</td>
                  <td className={td}>{item.band ?? "N/A"}</td>
                  <td className={td}>{item.equipmentType ?? "N/A"}</td>
                  <td className={td}>{item.origin ?? "N/A"}</td>
                  <td className={td}>{item.quantity}</td>
                  <td className={td}>{conditionBreakdownText(item)}</td>
                  <td className={td}>{RETURN_STATUS_LABEL[item.status]}</td>
                  <td className={td}>{item.remarks ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 border-t border-neutral-900 pt-6 break-inside-avoid sm:grid-cols-2">
          <SignatureLine label="Name / Rank" />
          <SignatureLine label="Signature / Date" />
        </div>
      </div>
    </main>
  )
}
