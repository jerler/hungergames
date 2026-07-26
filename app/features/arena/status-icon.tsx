import type { ReactNode } from "react";

import type { StatusEffectId } from "~/game/statuses/status-schema";

interface StatusIconProps {
  statusId: StatusEffectId;
}

interface StatusSvgProps {
  statusId: StatusEffectId;
  children: ReactNode;
}

function StatusSvg({ statusId, children }: StatusSvgProps) {
  return (
    <svg
      className="sidebar-tribute__status-icon"
      data-status-icon={statusId}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function StatusIcon({ statusId }: StatusIconProps) {
  switch (statusId) {
    case "hungry":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M4 11h16c0 5-3.2 8-8 8s-8-3-8-8Z" />
          <path d="M7 8c0-1.4 1.2-1.6 1.2-3" />
          <path d="M12 8c0-1.4 1.2-1.6 1.2-3" />
          <path d="M17 8c0-1.4 1.2-1.6 1.2-3" />
        </StatusSvg>
      );

    case "thirsty":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z" />
          <path d="M9 15.2c.5 1.2 1.5 1.8 3 1.8" />
        </StatusSvg>
      );

    case "exhausted":
      return (
        <span
          className="sidebar-tribute__status-icon sidebar-tribute__status-icon--text"
          data-status-icon={statusId}
          aria-hidden="true"
        >
          Zz
        </span>
      );

    case "injured":
    case "bleeding":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z" />
        </StatusSvg>
      );

    case "poisoned":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M9 3h6" />
          <path d="M10 3v6l-5 8.2A2.5 2.5 0 0 0 7.2 21h9.6a2.5 2.5 0 0 0 2.2-3.8L14 9V3" />
          <path d="M8 14h8" />
          <path d="m10 17 4 2" />
          <path d="m14 17-4 2" />
        </StatusSvg>
      );

    case "burned":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M13.5 3c.7 4-2.8 4.8-2.8 8 0 1.5.9 2.5 2.2 2.9-.2-2.1 1.4-3.2 2.5-4.6 1.8 1.7 3.1 3.7 3.1 6.1A6.5 6.5 0 0 1 5.5 15c0-3.4 2.2-5.7 4.5-8.2.2 2 1 2.7 1.7 3.2.1-2.5 1.8-4.2 1.8-7Z" />
        </StatusSvg>
      );

    case "disoriented":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M12 5a7 7 0 1 1-6.4 4.2" />
          <path d="M8.5 9.5A4.5 4.5 0 1 1 12 16.5" />
          <path d="M12 12h.01" />
        </StatusSvg>
      );

    case "hidden":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
          <path d="M12 9a3 3 0 0 1 3 3" />
          <path d="m4 4 16 16" />
        </StatusSvg>
      );

    case "well-fed":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M4 12h14c0 4.5-2.8 7-7 7s-7-2.5-7-7Z" />
          <path d="M7 9c0-1.2 1-1.5 1-2.7" />
          <path d="m18.5 4 .5 1.5L20.5 6 19 6.5 18.5 8 18 6.5 16.5 6 18 5.5 18.5 4Z" />
        </StatusSvg>
      );

    case "well-rested":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M17.5 16.5A7.5 7.5 0 0 1 8 6.5a7.5 7.5 0 1 0 9.5 10Z" />
          <path d="m18 4 .4 1.2L20 6l-1.6.8L18 8l-.4-1.2L16 6l1.6-.8L18 4Z" />
        </StatusSvg>
      );

    case "alert":
      return (
        <StatusSvg statusId={statusId}>
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 2v2" />
        </StatusSvg>
      );

    case "lucky":
      return (
        <StatusSvg statusId={statusId}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="9" cy="9" r=".8" />
          <circle cx="15" cy="9" r=".8" />
          <circle cx="12" cy="12" r=".8" />
          <circle cx="9" cy="15" r=".8" />
          <circle cx="15" cy="15" r=".8" />
        </StatusSvg>
      );

    case "hunted":
      return (
        <StatusSvg statusId={statusId}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </StatusSvg>
      );

    case "inspired":
      return (
        <StatusSvg statusId={statusId}>
          <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
          <path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
        </StatusSvg>
      );
  }
}
