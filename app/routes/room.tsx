import { RoutePlaceholder } from "~/components/route-placeholder";

export function meta() {
  return [{ title: "Audience Room | Hunger Games Simulator" }];
}

export default function RoomPage() {
  return (
    <RoutePlaceholder
      title="Audience Room"
      description="Audience voting and room status will appear here."
    />
  );
}
