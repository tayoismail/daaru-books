export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
      {/* Rounded brand tile */}
      <rect x="1" y="1" width="42" height="42" rx="11" fill="#1a5c3a" />
      {/* 8-point Islamic star */}
      <path
        d="M22 8.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z"
        fill="#c9a84c"
      />
      {/* Open book */}
      <path d="M12.8 23.4l8.1.7v6l-8.1-.8z" fill="#ffffff" opacity="0.95" />
      <path d="M23.1 24.1l8.1-.7v6l-8.1.8z" fill="#ffffff" opacity="0.75" />
      <line
        x1="22"
        y1="23.7"
        x2="22"
        y2="30.1"
        stroke="#1a5c3a"
        strokeWidth="1.1"
      />
    </svg>
  );
}
