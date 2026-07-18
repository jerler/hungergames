import { RoutePlaceholder } from "~/components/route-placeholder";

export function meta() {
  return [{ title: "The Reaping | Hunger Games Simulator" }];
}

export default function ReapingPage() {
  return (
    <RoutePlaceholder
      title="The Reaping"
      description="Tributes and district assignments will be configured here."
    />
  );
}
