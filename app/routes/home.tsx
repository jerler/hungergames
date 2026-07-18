import { Link } from "react-router";

export function meta() {
  return [
    {
      title: "Hunger Games Simulator",
    },
    {
      name: "description",
      content: "Create, configure, and simulate your own Hunger Games.",
    },
  ];
}

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="Hunger Games Simulator home">
          <span className="landing-brand__mark" aria-hidden="true">
            XII
          </span>

          <span>Hunger Games Simulator</span>
        </Link>

        <Link className="landing-header__join" to="/join">
          Join a room
        </Link>
      </header>

      <main className="landing-hero">
        <section className="landing-hero__content">
          <p className="landing-hero__eyebrow">The arena is waiting</p>

          <h1 className="landing-hero__title">
            <span>Create your tributes.</span>
            <strong>Let the Games begin.</strong>
          </h1>

          <p className="landing-hero__description">
            Assemble the districts, shape each tribute, and discover who survives your arena.
          </p>

          <div className="landing-hero__actions">
            <Link className="landing-action landing-action--primary" to="/create">
              Create the Games
              <span aria-hidden="true">→</span>
            </Link>

            <Link className="landing-action landing-action--secondary" to="/join">
              Join an audience
            </Link>
          </div>
        </section>

        <div className="landing-emblem" aria-hidden="true">
          <div className="landing-emblem__outer">
            <div className="landing-emblem__inner">
              <span>XII</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <span>May the odds be ever in your favour.</span>
        <span>Made by Julie</span>
      </footer>
    </div>
  );
}
