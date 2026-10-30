interface PriceTagProps {
  value: number;
  emphasize?: boolean;
}

export function PriceTag({ value, emphasize = false }: PriceTagProps) {
  return (
    <span
      className={`font-extrabold ${emphasize ? 'text-2xl' : 'text-lg'}`}
      style={{ color: emphasize ? '#00C853' : 'var(--ion-text-color)' }}
    >
      R$ {value.toFixed(2).replace('.', ',')}
    </span>
  );
}
