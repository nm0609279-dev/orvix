const PATHS: Record<string, string[]> = {
  plus: ["M5 12h14", "M12 5v14"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  send: ["M12 19V5", "M5 12l7-7 7 7"],
  stop: ["M7 7h10v10H7z"],
  chevron: ["m6 9 6 6 6-6"],
  search: ["M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M21 21l-4.3-4.3"],
  chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  code: ["m16 18 6-6-6-6", "M8 6l-6 6 6 6"],
  image: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M8.5 8.5h.01", "m21 15-5-5L5 21"],
  agent: [
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M23 21v-2a4 4 0 0 0-3-3.9",
    "M16 3.1a4 4 0 0 1 0 7.8",
  ],
  settings: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2", "M12 20v2", "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M2 12h2", "M20 12h2", "M4.9 19.1l1.4-1.4", "M17.7 6.3l1.4-1.4"],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
  key: ["M21 2l-2 2", "M15.5 7.5l3 3L22 7l-3-3", "M11.4 11.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8z", "M15.5 7.5l-4 4"],
  trash: ["M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6", "M10 11v6", "M14 11v6"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  copy: ["M9 9h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z", "M5 15H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1"],
  check: ["M20 6 9 17l-5-5"],
  clip: ["M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"],
  refresh: ["M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5"],
  play: ["M6 4l14 8-14 8z"],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  bolt: ["M13 2 3 14h9l-1 8 10-12h-9z"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  panel: ["M3 5h18v14H3z", "M9 5v14"],
};

export default function Icon({
  name,
  className = "w-4 h-4",
  fill = false,
  strokeWidth = 2,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  const paths = PATHS[name] || [];
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function Logo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg1" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1783ff" />
          <stop offset=".55" stopColor="#7a5cff" />
          <stop offset="1" stopColor="#ff6fb1" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#lg1)" />
      <ellipse cx="16" cy="16" rx="14" ry="5.2" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" transform="rotate(-28 16 16)" />
      <circle cx="16" cy="16" r="4.2" fill="#fff" />
    </svg>
  );
}
