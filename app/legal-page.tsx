import type { ReactNode } from "react";
import Link from "next/link";

export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-shell">
      <article className="legal-card">
        <Link className="legal-back" href="/">
          ← Back to Blind Trading
        </Link>
        <h1>{title}</h1>
        <p className="legal-updated">Effective August 30, 2026</p>
        {children}
        <p className="legal-note">
          Blind Trading is an independent educational project. It is not a broker,
          exchange, investment adviser, or trading signal service.
        </p>
      </article>
    </main>
  );
}
