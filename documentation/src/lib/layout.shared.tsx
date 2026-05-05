import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import stpsLogo from "@/assets/stps_logo.svg";
import stpsLogoLightMode from "@/assets/stps_logo_lightmode.svg";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="stps-docs-logo-wrap" aria-label="STPS">
          <img
            src={stpsLogoLightMode.src}
            alt=""
            className="stps-docs-logo stps-docs-logo-light"
          />
          <img
            src={stpsLogo.src}
            alt=""
            className="stps-docs-logo stps-docs-logo-dark"
          />
        </span>
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
