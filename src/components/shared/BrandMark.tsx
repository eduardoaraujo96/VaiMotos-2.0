interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{
          width: compact ? 40 : 52,
          height: compact ? 40 : 52,
          background: 'linear-gradient(135deg, #FF6B00 0%, #FF9A3D 100%)',
          boxShadow: '0 8px 20px rgba(255, 107, 0, 0.35)',
        }}
      >
        <svg width={compact ? 22 : 28} height={compact ? 22 : 28} viewBox="0 0 24 24" fill="none">
          <path
            d="M4 16h2.2l1.3-4h5.8l1.6 4H18M7.2 12 8.4 7h4.3l1.1 5"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7" cy="17.5" r="1.6" fill="#fff" />
          <circle cx="17" cy="17.5" r="1.6" fill="#fff" />
        </svg>
      </div>
      {!compact && (
        <div>
          <div className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--ion-text-color)' }}>
            VaiMoto
          </div>
          <div className="text-xs font-medium" style={{ color: 'var(--ion-color-medium)' }}>
            Mototaxi e entregas
          </div>
        </div>
      )}
    </div>
  );
}
