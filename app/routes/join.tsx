import { RoutePlaceholder } from "~/components/route-placeholder";

export function meta() {
  return [{ title: "Join the Games | Hunger Games Simulator" }];
}

export default function JoinPage() {
  return (
    <RoutePlaceholder
      title="Join the Games"
      description="Audience members will enter their room code here."
    />
  );
}
