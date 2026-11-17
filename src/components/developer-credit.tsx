import Link from "next/link";
import { developer } from "@/lib/credits";

export function DeveloperCredit() {
  return (
    <span>
      Desarrollado por{" "}
      <Link
        href={developer.href}
        rel="author"
        className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
      >
        {developer.name}
      </Link>
    </span>
  );
}
