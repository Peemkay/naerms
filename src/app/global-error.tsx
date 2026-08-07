"use client"

// Only renders if the root layout itself throws — it must supply its own
// <html>/<body> since it replaces the entire layout tree in that case.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ background: "#111318", color: "#e8eaee" }}>
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>NAERMS failed to load</h1>
          <p style={{ fontSize: "0.875rem", color: "#9aa1ad", maxWidth: 360 }}>
            A critical error occurred. Try reloading — if it persists, contact your system
            administrator.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#9aa1ad" }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              borderRadius: "0.5rem",
              border: "1px solid #3a3f4b",
              padding: "0.5rem 1rem",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
