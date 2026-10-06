import type React from "react";
import { C } from "./theme";

const STAR =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

type StarProps = {
  readonly size: number;
  /** 0..1 — how much of the star is filled gold, left to right. */
  readonly fill?: number;
  readonly color?: string;
  readonly empty?: string;
  readonly style?: React.CSSProperties;
};

export const Star: React.FC<StarProps> = ({
  size,
  fill = 1,
  color = C.orange,
  empty = C.border,
  style,
}) => (
  <div style={{ position: "relative", width: size, height: size, ...style }}>
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ position: "absolute" }}>
      <path d={STAR} fill={empty} />
    </svg>
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{
        position: "absolute",
        clipPath: `inset(0 ${(1 - Math.max(0, Math.min(1, fill))) * 100}% 0 0)`,
      }}
    >
      <path d={STAR} fill={color} />
    </svg>
  </div>
);

export const StarRow: React.FC<{ readonly size: number; readonly gap?: number; readonly rating?: number }> = ({
  size,
  gap = size * 0.15,
  rating = 5,
}) => (
  <div style={{ display: "flex", direction: "ltr", gap }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <Star key={i} size={size} fill={rating - i} />
    ))}
  </div>
);

export const GoogleG: React.FC<{ readonly size: number }> = ({ size }) => (
  <svg viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

type IconProps = { readonly size: number; readonly color?: string };

const icon = (d: string): React.FC<IconProps> => {
  const Icon: React.FC<IconProps> = ({ size, color = C.orange }) => (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d={d} fill={color} />
    </svg>
  );
  return Icon;
};

export const StarIcon = icon(STAR);
export const PinIcon = icon(
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
);
export const PeopleIcon = icon(
  "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
);
export const ThumbIcon = icon(
  "M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z",
);
export const QuoteIcon = icon("M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z");
