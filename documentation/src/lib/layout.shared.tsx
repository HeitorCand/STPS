import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img src="/stps_logo.svg" alt="STPS" className="stps-docs-logo" />
        </>
      ),
    },
    links: [
      {
        text: "Intro",
        url: "/docs",
        active: "nested-url",
      },
      {
        text: "GitHub",
        url: "https://github.com/HeitorCand/STPS",
        external: true,
      },
    ],
  };
}
