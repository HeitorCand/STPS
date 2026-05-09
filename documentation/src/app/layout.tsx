import "@/app/global.css";
import "katex/dist/katex.css";

import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import SearchDialog from "@/components/search";

export const metadata: Metadata = {
  title: {
    default: "STPS Docs",
    template: "%s | STPS Docs",
  },
  description:
    "Documentation for STPS, the Solana Trust Protocol Standard.",
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        <RootProvider
          search={{
            SearchDialog,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
