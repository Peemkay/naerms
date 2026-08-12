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

// Every cell carries a full border on all four sides, in a colour dark
// enough to survive a low-toner office printer and a phone screen alike —
// this is a register sheet, so the grid has to read as a grid everywhere.
// `border-collapse` on the table merges adjacent borders into single lines.
const th = "border border-neutral-500 py-0.5 px-1 text-left align-bottom break-words"
const td = "border border-neutral-500 py-0.5 px-1 align-top break-words"

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
    <main className="min-h-screen bg-neutral-100 px-3 py-6 text-neutral-900 sm:px-6 sm:py-10 print:bg-white print:p-0">
      {/* Page numbers come from @page margin boxes: Chromium 131+ and
          Safari 18.2+ support them, Firefox ignores them entirely (bug
          1854974) and prints unnumbered. Declaring any margin box also
          suppresses the browser's own header/footer, which is what we
          want — the sheet carries only this centered number. */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
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

        /* The sheet is a fixed A4 landscape document, not a responsive
           layout: it is laid out at a constant 277mm (A4 landscape width
           less the 10mm margins) and then scaled down as a whole to fit
           whatever screen is looking at it. Scaling rather than reflowing
           is what makes the preview a true representation of the printed
           page — column proportions, borders, and line breaks stay
           identical on a phone, and nothing is ever hidden off to the right
           or behind a scroll bar.

           zoom is used rather than a scale() transform because zoom
           participates in layout: the element's box shrinks with it, so no
           phantom gap is left underneath. Supported in Chrome, Safari 18+,
           and Firefox 126+ — the same modern-browser envelope the @page
           margin boxes above already require.

           The steps are tighter than the portrait version was because the
           sheet is now half again as wide, so a given screen needs more
           reduction to fit it. */
        .sheet-scale { width: 277mm; }
        @media (max-width: 1180px) { .sheet-scale { zoom: 0.82; } }
        @media (max-width: 980px) { .sheet-scale { zoom: 0.66; } }
        @media (max-width: 780px) { .sheet-scale { zoom: 0.52; } }
        @media (max-width: 620px) { .sheet-scale { zoom: 0.40; } }
        @media (max-width: 480px) { .sheet-scale { zoom: 0.31; } }
        @media (max-width: 380px) { .sheet-scale { zoom: 0.25; } }
        /* Print gets the document at exactly 1:1 — the screen fitting is
           irrelevant once it's on paper, and @page owns the margins. */
        @media print {
          .sheet-scale { width: auto; zoom: 1; }
        }
      `}</style>

      <div className="mx-auto flex w-fit justify-end pb-4 print:hidden">
        <PrintButton />
      </div>

      {/* p-8 is preview-only chrome: in print it would stack on top of the
          12mm @page margin and eat into the width the table is tuned for.
          The white page floats on a grey ground so the sheet's own edges
          are visible on screen, the way a document preview should read. */}
      <div className="sheet-scale mx-auto border border-neutral-300 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
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

        {/* Fixed 3-up, not responsive: inside .sheet-scale the sheet is
            always 186mm wide regardless of the device, so a breakpoint here
            would key off the viewport and rearrange a document that hasn't
            actually changed width. */}
        <div className="mb-6 grid grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Request Ref" value={ret.requestRef} />
          <Field label="Fmn/Unit" value={ret.formation.name} />
          <Field label="Auth" value={ret.auth} />
        </div>

        {/* No scroll container at all, on any screen. The sheet is a fixed
            portrait document — the same 13 columns in the same proportions
            on a phone as on paper, shrinking to fit rather than sliding
            sideways. A scroll box here hid the right-most columns on narrow
            screens and, worse, clipped to sheet one when printing, silently
            swallowing every later row. */}
        <div className="mb-8">
          <table className="w-full table-fixed border-collapse text-[10px]">
            {/* Explicit relative widths, not equal columns — table-fixed
                needs these to give Equipment/Condition/Remarks room to wrap
                sensibly instead of splitting every column evenly. Tuned for
                A4 landscape (~277mm inside the 10mm margins), which is wide
                enough that the fixed-size columns (SER, Date, Qty, Status)
                can take a smaller share and hand it to the free-text ones.
                Date and Status stay wide enough to keep "01 Jan 2026" and
                "Discrepancy" on one line at 10px, and Condition is the
                widest non-Remarks column because a full breakdown reads
                "3 Awaiting Evacuation, 2 Under Repair". */}
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[12%]" />
              <col className="w-[7%]" />
              <col className="w-[4%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[3%]" />
              <col className="w-[13%]" />
              <col className="w-[6%]" />
              <col className="w-[15%]" />
            </colgroup>
            {/* Multi-page prints are still the norm for a long register, so
                repeat the header row on each sheet. */}
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

        {/* Fixed 2-up for the same reason as the header grid above. */}
        <div className="grid grid-cols-2 gap-6 border-t border-neutral-900 pt-6 break-inside-avoid">
          <SignatureLine label="Name / Rank" />
          <SignatureLine label="Signature / Date" />
        </div>
      </div>
    </main>
  )
}
