import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="stps-docs-logo-wrap" aria-label="STPS">
          <img src="/stps_logo_transparent.svg" alt="STPS" className="stps-docs-logo" />
        </span>
      ),
    },
    links: [
      {
        text: "Docs",
        url: "/docs",
        active: "nested-url",
      },
      {
        text: "App",
        url: "https://stps-client.vercel.app/",
        external: true,
      },
      {
        text: "SDK",
        url: "/docs/sdk/quickstart",
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
