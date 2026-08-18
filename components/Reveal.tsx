import { type PropsWithChildren } from "react";
import { useInView } from "react-intersection-observer";

interface RevealProps {
  /** Delay in ms before the reveal transition starts (for staggered grids). */
  delay?: number;
  /** Extra classes forwarded to the wrapper element. */
  className?: string;
}

/** Fades and slides content up the first time it scrolls into view. */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: PropsWithChildren<RevealProps>) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.12,
    rootMargin: "0px 0px -48px 0px",
  });

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${className} transition-all duration-700 ease-out ${
        inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
