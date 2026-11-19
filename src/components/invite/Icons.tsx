import type { SVGProps } from "react";

/** Ícones em traço fino (1.5px), desenhados para combinar com a tipografia editorial. */
type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
});

export const IconHeart = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
  </svg>
);
export const IconPin = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);
export const IconNavigate = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M20 4 4 11l7 2 2 7 7-16Z" />
  </svg>
);
export const IconCalendar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M8 3.5v4M16 3.5v4M4 10h16" />
  </svg>
);
export const IconClock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4.2l2.8 1.8" />
  </svg>
);
export const IconChat = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4.5 19.5 5.6 16A7.5 7.5 0 1 1 8.3 18.6l-3.8.9Z" />
    <path d="M9 10.5c.3 1.6 1.9 3.3 3.6 3.8l1.1-1 1.6.7-.4 1.4c-3.4 0-6.4-3-6.4-6.4l1.4-.4.7 1.6-1 1.1" strokeWidth={1.2} />
  </svg>
);
export const IconGift = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="9" width="16" height="11" rx="1.5" />
    <path d="M3.5 9h17M12 9v11M12 9c-1.5-3.5-5-4-5-1.8C7 9 12 9 12 9Zm0 0c1.5-3.5 5-4 5-1.8C17 9 12 9 12 9Z" />
  </svg>
);
export const IconExternal = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </svg>
);
export const IconMusic = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
);
export const IconMute = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <path d="M3 3l18 18" />
  </svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconMinus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 12h12" />
  </svg>
);
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 6v12M6 12h12" />
  </svg>
);
export const IconArrowDown = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />
  </svg>
);
export const IconSparkle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3.5c.5 4.3 3.7 7.5 8 8-4.3.5-7.5 3.7-8 8-.5-4.3-3.7-7.5-8-8 4.3-.5 7.5-3.7 8-8Z" />
  </svg>
);
