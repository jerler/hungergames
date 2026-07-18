import { RoutePlaceholder } from "~/components/route-placeholder";

export function meta() {
  return [{ title: "The Games | Hunger Games Simulator" }];
}

export default function GamePlayPage() {
  return (
    <RoutePlaceholder
      title="The Games"
      description="Day and Night events will be presented here."
    />
  );
}
