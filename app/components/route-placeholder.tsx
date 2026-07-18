import { Link } from "react-router";

interface RoutePlaceholderProps {
  description: string;
  title: string;
}

export function RoutePlaceholder({ description, title }: RoutePlaceholderProps) {
  return (
    <main className="page-shell">
      <section className="content-card">
        <p className="eyebrow">Phase 0 route</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>

        <Link to="/">Return to the route index</Link>
      </section>
    </main>
  );
}
