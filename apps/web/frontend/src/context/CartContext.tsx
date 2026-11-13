import { createContext, useContext, useMemo, useState } from "react";
import { CART_KEY, CART_SELECTION_KEY } from "../lib/constants";

interface CartContextValue {
  productIds: string[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  removeMany: (productIds: string[]) => void;
  clear: () => void;
  selectedIds: string[];
  toggleSelection: (productId: string) => void;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const initialProductIds = (() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      return [];
    }
  })() as string[];
  const [productIds, setProductIds] = useState<string[]>(initialProductIds);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(CART_SELECTION_KEY);
      return stored ? JSON.parse(stored) : initialProductIds;
    } catch {
      return initialProductIds;
    }
  });
  const updateProducts = (next: string[]) => {
    localStorage.setItem(CART_KEY, JSON.stringify(next));
    setProductIds(next);
  };
  const updateSelection = (next: string[]) => {
    localStorage.setItem(CART_SELECTION_KEY, JSON.stringify(next));
    setSelectedIds(next);
  };
  const value = useMemo(
    () => ({
      productIds,
      selectedIds,
      add: (id: string) => {
        updateProducts(productIds.includes(id) ? productIds : [...productIds, id]);
        updateSelection(selectedIds.includes(id) ? selectedIds : [...selectedIds, id]);
      },
      remove: (id: string) => {
        updateProducts(productIds.filter((item) => item !== id));
        updateSelection(selectedIds.filter((item) => item !== id));
      },
      removeMany: (ids: string[]) => {
        updateProducts(productIds.filter((item) => !ids.includes(item)));
        updateSelection(selectedIds.filter((item) => !ids.includes(item)));
      },
      clear: () => {
        updateProducts([]);
        updateSelection([]);
      },
      toggleSelection: (id: string) =>
        updateSelection(
          selectedIds.includes(id)
            ? selectedIds.filter((item) => item !== id)
            : [...selectedIds, id],
        ),
      count: productIds.length,
    }),
    [productIds, selectedIds],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart harus digunakan di dalam CartProvider");
  return value;
};
