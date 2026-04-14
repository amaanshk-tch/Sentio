import { useEffect, useRef } from "react";
export function FlowingPaths() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let raf: number;
    let t = 0;

    function animate() {
      t += 0.002;
      const paths = svg!.querySelectorAll<SVGPathElement>(".flow-path");
      paths.forEach((path, i) => {
        const offset = i * 120;
        const speed = 0.3 + i * 0.08;
        const dashOffset = (t * speed * 600 + offset) % 2000;
        path.style.strokeDashoffset = `${dashOffset}`;
      });
      raf = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  const paths = Array.from({ length: 30 }, (_, i) => {
    const yBase = 5 + (i / 30) * 90;
    const amplitude = 15 + Math.sin(i * 0.7) * 12;
    const frequency = 0.8 + (i % 5) * 0.15;
    const phaseShift = i * 25;

    const points: string[] = [];
    for (let x = -10; x <= 110; x += 2) {
      const y =
        yBase +
        Math.sin((x + phaseShift) * frequency * 0.03) * amplitude +
        Math.cos((x + phaseShift * 0.5) * 0.02) * (amplitude * 0.5);
      points.push(`${x},${y.toFixed(1)}`);
    }

    const d = `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(" ")}`;
    const opacity = 0.03 + (Math.sin(i * 0.5) + 1) * 0.04;
    const strokeWidth = 0.08 + Math.abs(Math.sin(i * 1.1)) * 0.12;

    return (
      <path
        key={i}
        className="flow-path"
        d={d}
        fill="none"
        stroke={i % 3 === 0 ? "hsl(185, 100%, 50%)" : "hsl(263, 70%, 65%)"}
        strokeWidth={strokeWidth}
        opacity={opacity}
        strokeDasharray="8 12"
        strokeLinecap="round"
      />
    );
  });

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {paths}
    </svg>
  );
}
