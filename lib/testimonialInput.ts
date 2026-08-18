// NOTE: Server-only module. Parses + validates the admin testimonials form
// (JSON body).

export interface ParsedTestimonialInput {
  name: string;
  handle: string;
  reviewEn: string;
  reviewAr: string;
  /** 1–5, whole number. */
  rating: number;
}

export type TestimonialInputResult =
  | { ok: true; data: ParsedTestimonialInput }
  | { ok: false; error: string };

const MAX_LEN = 2000;

/** Parse + validate the testimonial add/edit form. */
export function parseTestimonialInput(raw: unknown): TestimonialInputResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid testimonial payload" };
  }
  const body = raw as Record<string, unknown>;
  const str = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

  const name = str(body.name).slice(0, 80);
  const handle = str(body.handle).slice(0, 80);
  const reviewEn = str(body.reviewEn).slice(0, MAX_LEN);
  const reviewAr = str(body.reviewAr).slice(0, MAX_LEN);

  const ratingRaw =
    typeof body.rating === "number"
      ? body.rating
      : typeof body.rating === "string" && body.rating.trim() !== ""
        ? Number(body.rating)
        : 5;
  const rating = Number.isInteger(ratingRaw) ? ratingRaw : 5;

  if (!name) {
    return { ok: false, error: "Name is required" };
  }
  if (!reviewEn) {
    return { ok: false, error: "Review (English) is required" };
  }
  if (rating < 1 || rating > 5) {
    return { ok: false, error: "Rating must be between 1 and 5" };
  }

  return { ok: true, data: { name, handle, reviewEn, reviewAr, rating } };
}
