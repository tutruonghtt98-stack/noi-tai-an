import { Avatar } from "@/components/ui/avatar";
import { fmt } from "@/lib/i18n/format";

/** Xếp chồng tối đa `max` avatar (mỗi avatar sau avatar đầu lấn `-ml-2` lên avatar trước), người
 * còn dư hiện gộp thành 1 chip tròn "+N" cùng kích thước. Dùng cho danh sách nhiều người phụ trách. */
export function AvatarStack({
  people,
  max = 3,
  size = 24,
  moreLabel,
}: {
  people: { name: string; image?: string | null }[];
  max?: number;
  size?: number;
  /** Template cho aria-label chip "+N", vd "và {n} người khác" — "{n}" được thay bằng số dư.
   * Nếu bỏ qua, chip vẫn hiện "+N" nhưng không có aria-label. */
  moreLabel?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <span key={i} className={i > 0 ? "-ml-2" : undefined}>
          <Avatar name={p.name} image={p.image} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 grid place-items-center rounded-full bg-surface-3 font-semibold text-muted ring-2 ring-surface"
          style={{ width: size, height: size, fontSize: size * 0.34 }}
          aria-label={moreLabel ? fmt(moreLabel, { n: extra }) : undefined}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
