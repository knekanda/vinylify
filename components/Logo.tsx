"use client";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex select-none items-center gap-2.5 ${className}`}>
      <div className="relative h-9 w-9 logo-container">
        <svg
          viewBox="0 0 40 40"
          className="h-9 w-9"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="vinyl-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-accent)" />
              <stop offset="50%" stopColor="#17b34a" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            <radialGradient id="vinyl-shine" cx="35%" cy="35%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>

            <linearGradient id="groove-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
            </linearGradient>

            <filter id="vinyl-shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="var(--color-accent)" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Outer ring */}
          <circle cx="20" cy="20" r="19" fill="url(#vinyl-gradient)" filter="url(#vinyl-shadow)" />
          <circle cx="20" cy="20" r="19" fill="url(#vinyl-shine)" />

          {/* Grooves */}
          <circle cx="20" cy="20" r="17.5" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
          <circle cx="20" cy="20" r="16" fill="none" stroke="url(#groove-gradient)" strokeWidth="0.5" />
          <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.3" />
          <circle cx="20" cy="20" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
          <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.3" />
          <circle cx="20" cy="20" r="12" fill="none" stroke="url(#groove-gradient)" strokeWidth="0.5" />
          <circle cx="20" cy="20" r="11" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
          <circle cx="20" cy="20" r="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
          <circle cx="20" cy="20" r="9" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.3" />
          <circle cx="20" cy="20" r="8" fill="none" stroke="url(#groove-gradient)" strokeWidth="0.5" />

          {/* Center label */}
          <circle cx="20" cy="20" r="5.5" fill="#080808" />
          <circle cx="20" cy="20" r="5" fill="#0a0a0a" stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />

          {/* Center dot — accent green */}
          <circle cx="20" cy="20" r="2" fill="var(--color-accent)" />
          <circle cx="20" cy="20" r="1" fill="#4ade80" opacity="0.8" />

          {/* Specular highlight — static */}
          <ellipse
            cx="14"
            cy="14"
            rx="6"
            ry="4"
            fill="rgba(255,255,255,0.04)"
            transform="rotate(-30 14 14)"
          />
        </svg>

        <div className="logo-glow" />
      </div>

      <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] logo-text">
        Vinylify
      </h1>
    </div>
  );
}
