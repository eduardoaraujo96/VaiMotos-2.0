interface MapCanvasProps {
  height?: string;
  showRoute?: boolean;
}

export function MapCanvas({ height = '100%', showRoute = true }: MapCanvasProps) {
  return (
    <div className="vaimoto-map w-full" style={{ height, minHeight: 220 }}>
      <div className="absolute" style={{ top: '32%', left: '28%' }}>
        <div className="absolute -inset-3 rounded-full bg-orange-500/30 pulse" />
        <div className="pin bg-orange-500" />
      </div>
      <div className="absolute" style={{ top: '58%', left: '64%' }}>
        <div className="pin" style={{ background: '#1A1A2E' }} />
      </div>
      {showRoute && (
        <div
          className="road-line"
          style={{
            top: '42%',
            left: '32%',
            width: '38%',
            transform: 'rotate(22deg)',
          }}
        />
      )}
      <div
        className="absolute rounded-full"
        style={{
          width: 10,
          height: 10,
          background: '#00C853',
          top: '46%',
          left: '48%',
          boxShadow: '0 0 0 6px rgba(0,200,83,0.2)',
        }}
      />
    </div>
  );
}
