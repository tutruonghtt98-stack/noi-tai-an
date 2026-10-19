/* eslint-disable @next/next/no-img-element */
export function Avatar({ name, image, size = 40 }: { name: string; image?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  if (image) {
    return (
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover ring-2 ring-surface"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid place-items-center rounded-full bg-accent-soft font-semibold text-accent-ink ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </span>
  );
}
