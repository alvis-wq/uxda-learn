"use client";

/** Last-resort boundary (root layout failed): plain HTML, no providers or Tailwind guarantees. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 20 }}>UXDA Learn is having trouble</h1>
          <p style={{ color: "#555" }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid #ccc", background: "#b5a2ff", cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
