import Link from "next/link";

/** Shared top navigation: Home → Openings → Progress. */
export function Nav() {
  return (
    <nav className="border-b">
      <div className="container mx-auto flex items-center gap-4 py-3 text-sm">
        <Link href="/" className="font-semibold">
          Opening Dojo
        </Link>
        <Link href="/openings" className="text-muted-foreground hover:underline">
          Openings
        </Link>
        <Link href="/progress" className="text-muted-foreground hover:underline">
          Progress
        </Link>
      </div>
    </nav>
  );
}
