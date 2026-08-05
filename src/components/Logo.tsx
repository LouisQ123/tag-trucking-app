export default function Logo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 92 32" className={className} aria-hidden="true">
      <text
        x="0"
        y="24"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold"
        fontSize="24"
        fill="currentColor"
      >
        A
      </text>
      <text
        x="23"
        y="15.5"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="11"
        fill="currentColor"
      >
        ★
      </text>
      <text
        x="31"
        y="24"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold"
        fontSize="24"
        fill="currentColor"
      >
        T
      </text>
      <text
        x="50"
        y="15.5"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="11"
        fill="currentColor"
      >
        ★
      </text>
      <text
        x="58"
        y="24"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold"
        fontSize="24"
        fill="currentColor"
      >
        G
      </text>
    </svg>
  );
}
