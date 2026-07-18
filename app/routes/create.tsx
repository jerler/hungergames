import { useCallback, useState } from "react";
import { Link } from "react-router";

import { OpeningFanfare } from "~/features/opening/opening-fanfare";

export function meta() {
  return [
    {
      title: "Create the Games | Hunger Games Simulator",
    },
  ];
}

export default function CreatePage() {
  const [isOpeningVisible, setIsOpeningVisible] = useState(true);

  const completeOpening = useCallback(() => {
    setIsOpeningVisible(false);
  }, []);

  if (isOpeningVisible) {
    return <OpeningFanfare onComplete={completeOpening} />;
  }

  return (
    <main className="page-shell">
      <section className="content-card">
        <p className="eyebrow">Create the Games</p>

        <h1 className="page-title">Configure your arena</h1>

        <p className="page-description">
          Game size, gifts, audience participation, and gift frequency settings will be configured
          here next.
        </p>

        <p>
          <Link to="/">Return home</Link>
        </p>
      </section>
    </main>
  );
}
