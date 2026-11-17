import Link from "next/link";
import { Sparkles } from "lucide-react";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 text-foreground"
      aria-label="GlowBook, inicio"
    >
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-white">
        <Sparkles size={17} strokeWidth={1.4} />
      </span>
      <span
        className={`${small ? "text-2xl" : "text-[27px]"} serif tracking-tight`}
      >
        glowbook<span className="text-accent">.</span>
      </span>
    </Link>
  );
}
