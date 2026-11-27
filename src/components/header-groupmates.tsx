import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";

/** Dải avatar chồng mép — vài người cùng nhóm đồng hành, giống "collaborators" của Corbel. */
export function HeaderGroupmates({ people }: { people: { id: string; name: string | null; image: string | null }[] }) {
  if (!people.length) return null;
  return (
    <Link href="/community" className="hidden items-center -space-x-2 sm:flex" aria-label="Cộng đồng">
      {people.map((p) => (
        <Avatar key={p.id} name={p.name ?? "?"} image={p.image} size={32} />
      ))}
    </Link>
  );
}
