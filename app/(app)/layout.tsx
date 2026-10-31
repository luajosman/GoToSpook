import { AppFooter } from "@/components/AppFooter";

/** The team-facing app: every page here gets the footer. The personal pages under /p stay outside. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <AppFooter />
    </>
  );
}
