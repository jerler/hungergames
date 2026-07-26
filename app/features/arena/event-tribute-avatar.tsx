import type { GameTribute } from "~/game/types/game-state";

interface EventTributeAvatarProps {
  tribute: GameTribute | null;
  fallbackName: string;
  size?: "primary" | "compact";
  muted?: boolean;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function EventTributeAvatar({
  tribute,
  fallbackName,
  size = "compact",
  muted = false,
}: EventTributeAvatarProps) {
  const name = tribute?.snapshot.name ?? fallbackName;

  return (
    <span
      className="event-tribute-avatar"
      data-avatar-size={size}
      data-event-avatar-muted={muted ? "true" : "false"}
      aria-hidden="true"
    >
      {tribute?.snapshot.portraitUrl ? (
        <img
          src={tribute.snapshot.portraitUrl}
          alt=""
          style={{
            objectPosition:
              `${tribute.snapshot.portraitPosition?.x ?? 50}% ` +
              `${tribute.snapshot.portraitPosition?.y ?? 50}%`,
          }}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </span>
  );
}
