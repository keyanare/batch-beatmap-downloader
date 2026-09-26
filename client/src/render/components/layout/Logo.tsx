import React from "react";

export const Logo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
    <defs>
      <linearGradient id="bbd-logo" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ff7ab8" />
        <stop offset="1" stopColor="#b86bff" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="14.5" fill="url(#bbd-logo)" />
    <circle cx="16" cy="16" r="11" stroke="white" strokeOpacity="0.9" strokeWidth="2" />
    <path
      d="M16 9.5v10.2m0 0-4.2-4.2m4.2 4.2 4.2-4.2"
      stroke="white"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
