// Stroke icons used across the design boards.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20 L16 16" />
  </Icon>
);

export const FilterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6 H20" />
    <path d="M7 12 H17" />
    <path d="M10 18 H14" />
  </Icon>
);

export const MapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6 L9 3 L15 6 L21 3 V18 L15 21 L9 18 L3 21 Z" />
    <path d="M9 3 V18" />
    <path d="M15 6 V21" />
  </Icon>
);

export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21 V4" />
    <path d="M5 4 H17 L14.5 8 L17 12 H5" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21 C 5 16, 19 16, 20 21" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8 H7 L9 5 H15 L17 8 H20 V19 H4 Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);

export const VideoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10 L21 7 V17 L16 14" />
  </Icon>
);

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11 A 7 7 0 0 0 19 11" />
    <path d="M12 18 V21" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20 H8 L19 9 L15 5 L4 16 Z" />
    <path d="M13 7 L17 11" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon strokeWidth={2.8} {...p}>
    <path d="M12 4 V20" />
    <path d="M4 12 H20" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon strokeWidth={2.8} {...p}>
    <path d="M6 6 L18 18" />
    <path d="M18 6 L6 18" />
  </Icon>
);

export const BackIcon = (p: IconProps) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="M15 5 L8 12 L15 19" />
  </Icon>
);

export const GalleryIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-6-5-10 8" />
  </Icon>
);

export const ChevronIcon = (p: IconProps) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
