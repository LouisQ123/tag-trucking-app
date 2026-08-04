export default function Logo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 40" fill="currentColor" className={className} aria-hidden="true">
      <rect x="3" y="28" width="42" height="3" rx="1" />
      <circle cx="11" cy="32" r="6" />
      <circle cx="37" cy="32" r="6" />
      <path d="M3,29 L3,18 L8,18 L11,13 L18,13 L18,29 Z" />
      <path d="M18,29 L18,10 L41,10 L45,15 L45,29 Z" />
    </svg>
  );
}
