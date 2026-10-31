export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0F7B57" />
      <path d="M7 16h5.5c3.2 0 4.6-7 10.5-7" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M12.5 16c3.2 0 4.6 7 10.5 7" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="9" r="2.8" fill="#FFFFFF" />
      <circle cx="24" cy="23" r="1.9" fill="#FFFFFF" fillOpacity="0.6" />
    </svg>
  );
}
