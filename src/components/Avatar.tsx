interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, src, size = 36, className = '' }: AvatarProps) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  const colors = ['#3B4FE0', '#F5A623', '#2E7D32', '#D32F2F', '#1976D2', '#7B1FA2', '#00838F', '#E65100'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (src) {
    return <img src={src} alt={name} width={size} height={size} className={`rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <div className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${className}`} style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }} aria-hidden>
      {initials}
    </div>
  );
}
