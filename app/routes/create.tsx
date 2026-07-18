import { RoutePlaceholder } from "~/components/route-placeholder";

export function meta() {
  return [{ title: "Create the Games | Hunger Games Simulator" }];
}

export default function CreatePage() {
  return (
    <RoutePlaceholder
      title="Create the Games"
      description="The Game configuration experience will be built here."
    />
  );
}
