import { useEffect, useState } from "react";

/** Returns Date.now(), updated every `ms` (aligned to the second boundary for clocks). */
export function useTick(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      setNow(Date.now());
      t = setTimeout(loop, ms - (Date.now() % ms) + 5);
    };
    t = setTimeout(loop, ms - (Date.now() % ms) + 5);
    return () => clearTimeout(t);
  }, [ms]);
  return now;
}
