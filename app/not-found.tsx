import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-1 text-lg font-semibold">Page not found</h1>
      <Button asChild className="mt-5">
        <Link href="/dashboard">Back to overview</Link>
      </Button>
    </div>
  );
}
