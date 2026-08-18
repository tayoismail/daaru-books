import {
  Children,
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLanguage } from "@/lib/contexts";

interface HeroSliderProps {
  /** One full slide per child (badge, headline, CTA…). Each is 100% wide. */
  children: ReactNode[];
  /** Accessibility labels, provided by the caller via i18n. */
  labels: {
    region: string;
    goTo: (index: number) => string;
  };
  /** Autoplay interval in ms. Disabled when <= 0. */
  intervalMs?: number;
}

/**
 * Lightweight, dependency-free hero carousel.
 *
 * - Slides via CSS transform (translateX) with a smooth ease transition.
 * - RTL-aware: in Arabic the track moves in the mirrored direction and the
 *   arrow keys flip, so the carousel always feels "natural".
 * - Autoplays (pauses on hover / focus), with clickable dots for navigation.
 * - Keyboard accessible (←/→, Tab to dots).
 */
export default function HeroSlider({
  children,
  labels,
  intervalMs = 6000,
}: HeroSliderProps) {
  const { locale } = useLanguage();
  // Children.toArray flattens nested arrays (e.g. welcome slide + a mapped
  // array of book slides) into a single flat list, so slideCount and the
  // track/dots iterate the real slides — not wrapper arrays.
  const slides = Children.toArray(children);
  const slideCount = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const isRtl = locale === "ar";

  const goTo = useCallback(
    (next: number) => {
      // Wrap around (negative → last, >= count → first).
      setIndex(((next % slideCount) + slideCount) % slideCount);
    },
    [slideCount]
  );

  const next = useCallback(
    () => goTo(index + 1),
    [goTo, index]
  );
  const previous = useCallback(
    () => goTo(index - 1),
    [goTo, index]
  );

  // Autoplay — resets whenever the index changes or the carousel is paused.
  useEffect(() => {
    if (intervalMs <= 0 || paused || slideCount <= 1) return;
    const id = setInterval(next, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, paused, slideCount, next]);

  // In RTL the visual "left/right" is mirrored, so the arrow keys flip too.
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === (isRtl ? "ArrowLeft" : "ArrowRight")) {
      event.preventDefault();
      next();
    } else if (event.key === (isRtl ? "ArrowRight" : "ArrowLeft")) {
      event.preventDefault();
      previous();
    }
  };

  // RTL track: translateX(positive) moves the strip right — correct in RTL.
  const transform = isRtl
    ? `translateX(${index * 100}%)`
    : `translateX(-${index * 100}%)`;

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.region}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className="relative outline-none"
    >
      {/* Track */}
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${slideCount}`}
            aria-hidden={i !== index}
            className="w-full shrink-0"
          >
            {slide}
          </div>
        ))}
      </div>

      {/* Dots */}
      {slideCount > 1 && (
        <div className="absolute inset-x-0 bottom-8 z-20 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={labels.goTo(i + 1)}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                i === index
                  ? "w-7 bg-gold"
                  : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
