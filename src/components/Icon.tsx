/** Buyum/qism ikonkasi: mazmunda rasm yo'li (img/...webp) yoki emoji bo'lishi mumkin. */
export const isImagePath = (icon: string) => /\.(webp|png|jpe?g|svg)$/i.test(icon);

export function Icon({ icon, size = 32, className }: { icon: string; size?: number; className?: string }) {
  if (isImagePath(icon)) {
    return (
      <img
        src={icon}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
        className={`icon-img${className ? ` ${className}` : ''}`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={className} style={{ fontSize: size * 0.85, lineHeight: 1 }}>
      {icon}
    </span>
  );
}
