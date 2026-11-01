interface UnreadDotProps {
  visible: boolean;
}

export function UnreadDot({ visible }: UnreadDotProps) {
  if (!visible) return null;
  return <span className="unread-dot" aria-label="Mensagens não lidas" />;
}
