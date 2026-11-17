import Link from "next/link";
import { Sparkles } from "lucide-react";
import { developer } from "@/lib/credits";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 text-foreground"
      aria-label={`GlowBook por ${developer.name}, inicio`}
    >
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-white">
        <Sparkles size={17} strokeWidth={1.4} />
      </span>
      <span className="flex flex-col">
        <span
          className={`${small ? "text-2xl" : "text-[27px]"} serif tracking-tight`}
        >
          glowbook<span className="text-accent">.</span>
        </span>
        <span className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
          por {developer.name}
        </span>
      </span>
    </Link>
  );
}
