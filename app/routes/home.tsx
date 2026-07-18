import { Link } from "react-router";

const projectRoutes = [
  {
    path: "/create",
    label: "Create the Games",
  },
  {
    path: "/create/reaping",
    label: "Reaping",
  },
  {
    path: "/games/demo/play",
    label: "Games screen",
  },
  {
    path: "/games/demo/results",
    label: "Results",
  },
  {
    path: "/join",
    label: "Join a room",
  },
  {
    path: "/rooms/DEMO",
    label: "Audience room",
  },
];

export function meta() {
  return [
    {
      title: "Hunger Games Simulator",
    },
  ];
}

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="content-card">
        <p className="eyebrow">Phase 0</p>
        <h1 className="page-title">Hunger Games Simulator</h1>

        <p className="page-description">
          The project foundation is running. These temporary routes confirm that application
          routing, styling, and direct page navigation are ready for development.
        </p>

        <nav aria-label="Application routes">
          <ul className="route-list">
            {projectRoutes.map((projectRoute) => (
              <li key={projectRoute.path}>
                <Link className="route-link" to={projectRoute.path}>
                  {projectRoute.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </main>
  );
}
