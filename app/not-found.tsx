import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[1280px] px-8 pt-7 pb-16">
        <h1 className="m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]">Not found</h1>
        <p className="mt-2 text-muted">There is no page at this address.</p>
        <Link href="/leads" className="mt-4 inline-flex min-h-11 items-center font-semibold no-underline">
          Back to the leads
        </Link>
      </main>
    </>
  );
}
