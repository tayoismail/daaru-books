import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { useLanguage } from "@/lib/contexts";

interface BookCarouselProps {
  /** Section heading shown above the row. */
  title: string;
  /** Optional one-line subtitle under the heading. */
  subtitle?: string;
  /** Optional small kicker label above the title (e.g. "Our Collection"). */
  kicker?: string;
  /** Optional "View all" link on the heading row. */
  viewAllHref?: string;
  /** Localized label for the "View all" link. */
  viewAllLabel?: string;
  /** Autoplay interval in ms. 0 (default) disables autoplay — enable it only
   * where wanted (e.g. the homepage sections). */
  autoplayMs?: number;
  /** Book cards (or any fixed-width items) to show in the row. */
  children: ReactNode[];
}

/**
 * Horizontal, snap-scrolling book row with prev/next arrows — the same
 * arrangement RH Books uses under their hero. RTL-aware.
 *
 * - Cards snap to the row's start edge (right edge in Arabic).
 * - Arrows (desktop only; touch users swipe) page by a full row of cards
 *   (one fewer than fits, so there is always a card of context), using
 *   `scrollIntoView` on the target item — no scrollLeft sign math needed and
 *   it works identically in LTR and RTL. They disable at the row's ends.
 * - Optional autoplay (opt-in via `autoplayMs`): slides one card at a time,
 *   only on devices with a pointer/hover (touch users swipe), pauses on
 *   hover/focus, and stops once the row reaches the end.
 * - Keyboard accessible: focus the row and use ←/→ (flipped in RTL).
 * - All scrolling is horizontal-only (scrollTo on the row) — the page's
 *   vertical scroll is never touched, so a row near the viewport edge can't
 *   make the page jump up/down as it advances.
 */
export default function BookCarousel({
  title,
  subtitle,
  kicker,
  viewAllHref,
  viewAllLabel,
  autoplayMs = 0,
  children,
}: BookCarouselProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isRtl = locale === "ar";

  const items = Children.toArray(children);

  // Whether the row can still scroll backwards / forwards (arrow state).
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [paused, setPaused] = useState(false);

  // The paused mirror lets the autoplay interval read the latest value
  // without being re-created on every pause/resume.
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // The "start" of the row is the right edge in RTL, left edge in LTR.
  const startEdge = isRtl ? "right" : "left";

  const updateArrowState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-snap-item]")
    );
    if (cards.length === 0) {
      setAtStart(true);
      setAtEnd(true);
      return;
    }
    // No overflow → the row fits; both arrows are pointless.
    if (scroller.scrollWidth <= scroller.clientWidth + 1) {
      setAtStart(true);
      setAtEnd(true);
      return;
    }
    const containerRect = scroller.getBoundingClientRect();
    const tolerance = 4;
    const first = cards[0].getBoundingClientRect()[startEdge];
    const last = cards[cards.length - 1].getBoundingClientRect()[startEdge];
    setAtStart(Math.abs(first - containerRect[startEdge]) <= tolerance);
    setAtEnd(Math.abs(last - containerRect[startEdge]) <= tolerance);
  }, [startEdge]);

  useEffect(() => {
    updateArrowState();
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.addEventListener("scroll", updateArrowState, { passive: true });
    window.addEventListener("resize", updateArrowState);
    return () => {
      scroller.removeEventListener("scroll", updateArrowState);
      window.removeEventListener("resize", updateArrowState);
    };
  }, [updateArrowState]);

  /** How many cards are (at least partly) visible in the viewport. */
  const visibleCount = useCallback(() => {
    const scroller = scrollerRef.current;
    const first = scroller?.querySelector<HTMLElement>("[data-snap-item]");
    if (!scroller || !first) return 1;
    const width = first.getBoundingClientRect().width;
    const gap =
      Number.parseFloat(getComputedStyle(scroller).columnGap) || 20;
    return Math.max(
      1,
      Math.floor((scroller.clientWidth + gap) / (width + gap))
    );
  }, []);

  /** Step `count` cards toward the start (direction -1) or end (direction 1). */
  const scrollCards = useCallback(
    (direction: 1 | -1, count: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const cards = Array.from(
        scroller.querySelectorAll<HTMLElement>("[data-snap-item]")
      );
      if (cards.length === 0) return;

      // The "current" card is the one whose start edge sits at the scroller's
      // start edge. Step to its neighbor and align it there.
      const containerRect = scroller.getBoundingClientRect();
      let current = 0;
      let closest = Infinity;
      cards.forEach((card, i) => {
        const distance = Math.abs(
          card.getBoundingClientRect()[startEdge] - containerRect[startEdge]
        );
        if (distance < closest) {
          closest = distance;
          current = i;
        }
      });

      const target = Math.min(
        cards.length - 1,
        Math.max(0, current + direction * count)
      );
      const targetRect = cards[target].getBoundingClientRect();
      // Horizontal-only scroll on the row itself. Unlike scrollIntoView this
      // never touches any other scroll container, so the page never moves
      // vertically. The delta is measured in physical viewport pixels, and
      // `scrollLeft` is already convention-consistent with the browser's RTL
      // sign handling (negative toward the left), so the same formula works
      // for LTR and RTL — no mirroring needed.
      const delta = targetRect[startEdge] - containerRect[startEdge];
      scroller.scrollTo({
        left: scroller.scrollLeft + delta,
        behavior: "smooth",
      });
    },
    [startEdge]
  );

  // Arrows page by almost a full row of cards (one overlap for context).
  const pageBy = useCallback(
    (direction: 1 | -1) =>
      scrollCards(direction, Math.max(1, visibleCount() - 1)),
    [scrollCards, visibleCount]
  );

  // Autoplay: one card at a time, hover/pointer devices only, paused on
  // hover/focus, and it never loops — the interval is dropped once the row
  // hits the end (and recreated if the user scrolls back).
  useEffect(() => {
    if (!autoplayMs || autoplayMs <= 0 || atEnd) return;
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) {
      return;
    }
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      scrollCards(1, 1);
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, atEnd, scrollCards]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === (isRtl ? "ArrowLeft" : "ArrowRight")) {
      event.preventDefault();
      scrollCards(1, 1);
    } else if (event.key === (isRtl ? "ArrowRight" : "ArrowLeft")) {
      event.preventDefault();
      scrollCards(-1, 1);
    }
  };

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  return (
    <div
      className="container-daaru py-8 md:py-10"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {kicker && (
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-700">
              {kicker}
            </p>
          )}
          <h2
            className={`font-bold uppercase tracking-wide text-primary-800 ${
              kicker ? "mt-1.5 text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
            }`}
          >
            {title}
          </h2>
          <div className="mt-2.5 h-1 w-14 rounded-full bg-gold" />
          {subtitle && <p className="mt-3 text-slate-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {viewAllHref && viewAllLabel && (
            <Link
              href={viewAllHref}
              className="text-sm font-semibold text-primary underline-offset-4 transition-colors hover:text-gold-700 hover:underline"
            >
              {viewAllLabel} →
            </Link>
          )}
          {/* Arrows (desktop only — touch users swipe the row) */}
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              onClick={() => pageBy(-1)}
              disabled={atStart}
              aria-label={t("books.previous")}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                atStart
                  ? "cursor-default border-slate-200 text-slate-300"
                  : "border-gold bg-gold/10 text-gold-700 hover:bg-gold hover:text-slate-900"
              }`}
            >
              <FontAwesomeIcon
                icon={isRtl ? faChevronRight : faChevronLeft}
                className="h-3.5 w-3.5"
              />
            </button>
            <button
              type="button"
              onClick={() => pageBy(1)}
              disabled={atEnd}
              aria-label={t("books.next")}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                atEnd
                  ? "cursor-default border-slate-200 text-slate-300"
                  : "border-gold bg-gold/10 text-gold-700 hover:bg-gold hover:text-slate-900"
              }`}
            >
              <FontAwesomeIcon
                icon={isRtl ? faChevronLeft : faChevronRight}
                className="h-3.5 w-3.5"
              />
            </button>
          </div>
        </div>
      </div>

      {/* Row */}
      <div
        ref={scrollerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="region"
        aria-label={title}
        className="mt-6 flex snap-x snap-proximity gap-5 overflow-x-auto px-1 pb-2 outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:ring-2 focus-visible:ring-gold"
      >
        {items.map((item, i) => (
          <div
            key={i}
            data-snap-item
            className="w-36 shrink-0 snap-start sm:w-40 md:w-44 xl:w-48"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
