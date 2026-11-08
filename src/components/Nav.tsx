import Link from "next/link";

/** Shared top navigation: Home → Train → Openings → Progress. */
export function Nav() {
  return (
    <nav className="border-b">
      <div className="container mx-auto flex items-center gap-1 py-2 text-sm sm:gap-4">
        <Link href="/" className="mr-auto py-2 pr-2 font-semibold sm:mr-0">
          Opening Dojo
        </Link>
        <Link href="/train" className="rounded px-2 py-2 font-medium hover:bg-accent">
          Train
        </Link>
        <Link href="/openings" className="rounded px-2 py-2 text-muted-foreground hover:bg-accent">
          Openings
        </Link>
        <Link href="/progress" className="rounded px-2 py-2 text-muted-foreground hover:bg-accent">
          Progress
        </Link>
      </div>
    </nav>
  );
}
