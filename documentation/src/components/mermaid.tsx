"use client";

import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  themeVariables: {
    background: "#071712",
    primaryColor: "#0d2620",
    primaryTextColor: "#e6f2ed",
    primaryBorderColor: "#1f5f4d",
    lineColor: "#4fd1bd",
    secondaryColor: "#0f1f2f",
    secondaryTextColor: "#d7ebff",
    secondaryBorderColor: "#2b6cb0",
    tertiaryColor: "#0b1714",
    tertiaryBorderColor: "#245144",
    fontFamily: "inherit",
  },
});

type MermaidProps = {
  chart: string;
};

export function Mermaid({ chart }: MermaidProps) {
  const id = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      try {
        const result = await mermaid.render(`stps-mermaid-${id}`, chart);

        if (cancelled) return;

        setSvg(result.svg);
        setError(null);

        if (containerRef.current && result.bindFunctions) {
          result.bindFunctions(containerRef.current);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to render Mermaid diagram.");
      }
    }

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="stps-mermaid stps-mermaid--fallback">
        <strong>Diagram unavailable</strong>
        <pre>{chart}</pre>
      </div>
    );
  }

  return (
    <div className="stps-mermaid">
      {svg ? (
        <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <pre>{chart}</pre>
      )}
    </div>
  );
}
