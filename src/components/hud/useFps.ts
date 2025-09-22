import { useEffect, useRef, useState } from "react";

export function useFps(sampleMs = 500): number {
  const [fps, setFps] = useState(0);
  const last = useRef(performance.now());
  const frames = useRef(0);
  const acc = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const dt = now - last.current;
      last.current = now;
      frames.current++;
      acc.current += dt;
      if (acc.current >= sampleMs) {
        setFps(Math.round((frames.current * 1000) / acc.current));
        frames.current = 0;
        acc.current = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sampleMs]);

  return fps;
}
