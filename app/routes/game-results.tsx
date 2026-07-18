import { RoutePlaceholder } from "~/components/route-placeholder";

export function meta() {
  return [{ title: "Results | Hunger Games Simulator" }];
}

export default function GameResultsPage() {
  return (
    <RoutePlaceholder
      title="Game Results"
      description="The victor and final Game statistics will be displayed here."
    />
  );
}
