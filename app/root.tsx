import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";

import "./app.css";

export const meta: Route.MetaFunction = () => [
  {
    title: "Hunger Games Simulator",
  },
  {
    name: "description",
    content: "Create, configure, and simulate your own Games.",
  },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>

      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message =
    "The application encountered an unexpected problem. Please return home and try again.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page not found";
      message = "The page you requested does not exist.";
    } else {
      title = `${error.status} ${error.statusText}`;
      message = "The requested page could not be loaded.";
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="page-shell">
      <section className="content-card">
        <p className="eyebrow">Error</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{message}</p>

        <p>
          <a href="/">Return to the home page</a>
        </p>

        {import.meta.env.DEV && error instanceof Error && error.stack ? (
          <pre className="error-details">{error.stack}</pre>
        ) : null}
      </section>
    </main>
  );
}
