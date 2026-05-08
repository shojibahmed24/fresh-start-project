import { Bitcoin } from "lucide-react";

type MethodType = "bkash" | "nagad" | "rocket" | "crypto";

/**
 * Inline SVG-styled brand marks for Bangladeshi mobile banking + crypto.
 * Uses brand-recognisable colors but keeps a unified stroke / radius.
 */
export const PaymentLogo = ({ type, size = 36 }: { type: MethodType; size?: number }) => {
  const dim = { width: size, height: size };
  const radius = size * 0.22;

  if (type === "bkash") {
    return (
      <svg viewBox="0 0 64 64" {...dim} aria-hidden>
        <rect x="2" y="2" width="60" height="60" rx={radius * (64 / size)} fill="#E2136E" />
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="800"
          fontSize="22"
          fill="white"
          letterSpacing="-1"
        >
          bK
        </text>
        <circle cx="48" cy="18" r="3" fill="white" opacity="0.9" />
      </svg>
    );
  }
  if (type === "nagad") {
    return (
      <svg viewBox="0 0 64 64" {...dim} aria-hidden>
        <rect x="2" y="2" width="60" height="60" rx={radius * (64 / size)} fill="#F36F21" />
        <path
          d="M18 44 V20 L34 38 V20 H46 V44 H38 L22 26 V44 Z"
          fill="white"
        />
      </svg>
    );
  }
  if (type === "rocket") {
    return (
      <svg viewBox="0 0 64 64" {...dim} aria-hidden>
        <defs>
          <linearGradient id="rk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8A1A8B" />
            <stop offset="1" stopColor="#4B0E5A" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx={radius * (64 / size)} fill="url(#rk)" />
        <path
          d="M32 12 L42 32 L36 32 L36 46 L28 46 L28 32 L22 32 Z"
          fill="white"
        />
        <path d="M22 50 H42" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  // crypto
  return (
    <div
      className="flex items-center justify-center rounded-[22%] bg-gradient-to-br from-amber-400 to-amber-600"
      style={dim}
    >
      <Bitcoin size={size * 0.6} className="text-white" strokeWidth={2.5} />
    </div>
  );
};
