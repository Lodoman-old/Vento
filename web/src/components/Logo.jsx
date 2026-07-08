export default function Logo({ size = 40, showText = true }) {
  const svgW = size * 3.2;
  return (
    <div className="flex flex-col items-center mx-auto" style={{ width: svgW }}>
      <svg viewBox="0 0 400 500" style={{ width: "100%", height: "auto" }} fill="none">
        <defs>
          <linearGradient id="logoLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E3A5F"/>
            <stop offset="100%" stopColor="#0F172A"/>
          </linearGradient>
          <linearGradient id="logoRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#67E8F9"/>
            <stop offset="100%" stopColor="#22D3EE"/>
          </linearGradient>
        </defs>
        <path d="M60 130 L180 410" stroke="url(#logoLeft)" strokeWidth="22" strokeLinecap="round"/>
        <path d="M340 130 L220 410" stroke="url(#logoRight)" strokeWidth="22" strokeLinecap="round"/>
        <circle cx="340" cy="130" r="22" fill="#22D3EE"/>
        <circle cx="340" cy="130" r="7" fill="#FFFFFF"/>
      </svg>
      {showText && (
        <span className="text-xs tracking-[0.3em] font-bold text-center text-slate-300 w-full" style={{ fontFamily: "'Montserrat', system-ui, sans-serif", marginTop: -4 }}>
          VENTO
        </span>
      )}
    </div>
  );
}
