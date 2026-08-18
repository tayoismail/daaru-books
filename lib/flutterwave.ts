/**
 * Flutterwave standard inline checkout (v3) — client-side helper.
 * Loads https://checkout.flutterwave.com/v3.js once and exposes a typed
 * wrapper around `FlutterwaveCheckout(...)`.
 */

export interface FlutterwaveCustomer {
  email: string;
  name?: string;
  phone_number?: string;
}

export interface FlutterwaveCallbackResponse {
  status: string;
  transaction_id?: number;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number;
  currency?: string;
}

export interface FlutterwaveCheckoutConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options?: string;
  customer: FlutterwaveCustomer;
  customizations?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  callback?: (response: FlutterwaveCallbackResponse) => void;
  onclose?: (incomplete: boolean) => void;
}

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: FlutterwaveCheckoutConfig) => void;
  }
}

const SCRIPT_SRC = "https://checkout.flutterwave.com/v3.js";
let scriptPromise: Promise<void> | null = null;

/** Inject the Flutterwave v3 script (idempotent; cached across calls). */
export function loadFlutterwaveScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.FlutterwaveCheckout) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null; // allow retry
        reject(new Error("Flutterwave script failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Open the inline payment modal. Returns false if the script is not ready. */
export function openFlutterwaveCheckout(
  config: FlutterwaveCheckoutConfig
): boolean {
  if (typeof window === "undefined" || !window.FlutterwaveCheckout) return false;
  window.FlutterwaveCheckout(config);
  return true;
}
