import Cookies from "js-cookie";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { CartItem } from "@/types";

const CART_COOKIE = "daaru_cart";

interface CartContextValue {
  items: CartItem[];
  /** Total quantity of items in the cart (sum of quantities). */
  count: number;
  /** Sum of price × quantity across all items. */
  total: number;
  addItem: (item: CartItem) => void;
  /** Quantity <= 0 removes the item. */
  updateQuantity: (bookId: string, quantity: number) => void;
  removeItem: (bookId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Hydrate from the cart cookie after mount. The read is deferred so setState
  // never runs synchronously inside the effect (flagged by react-hooks rules
  // and a cause of hydration mismatches).
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      try {
        const raw = Cookies.get(CART_COOKIE);
        if (!cancelled && raw) {
          setItems(JSON.parse(raw) as CartItem[]);
        }
      } catch {
        // Corrupted cookie — start with an empty cart.
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Persist the cart in a cookie (js-cookie) on every change. Only write when
  // the cart is non-empty so visitors without items get no cookie at all.
  useEffect(() => {
    try {
      if (items.length > 0) {
        Cookies.set(CART_COOKIE, JSON.stringify(items), {
          expires: 7,
          sameSite: "lax",
        });
      } else {
        Cookies.remove(CART_COOKIE);
      }
    } catch {
      // Cookie unavailable — non-fatal.
    }
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.bookId === item.bookId);
      if (existing) {
        return prev.map((i) =>
          i.bookId === item.bookId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const updateQuantity = useCallback((bookId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.bookId !== bookId)
        : prev.map((i) => (i.bookId === bookId ? { ...i, quantity } : i))
    );
  }, []);

  const removeItem = useCallback((bookId: string) => {
    setItems((prev) => prev.filter((i) => i.bookId !== bookId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, count, total, addItem, updateQuantity, removeItem, clear }),
    [items, count, total, addItem, updateQuantity, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
