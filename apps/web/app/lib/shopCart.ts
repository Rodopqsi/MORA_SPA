export type ProductImage = {
  id?: number;
  url: string;
  fileName?: string | null;
  source: 'URL' | 'LOCAL';
  order?: number;
  isCover: boolean;
};

export type CatalogProduct = {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  price: string | number;
  stock: number;
  active: boolean;
  featured: boolean;
  images: ProductImage[];
};

export type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  imageUrl?: string | null;
};

const STORAGE_KEY = 'shopCart';

export const productPrice = (value: string | number) => Number(value);

export const getProductCover = (product: { images: ProductImage[] }) => {
  return product.images.find((image) => image.isCover) ?? product.images[0] ?? null;
};

export const loadShopCart = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
};

export const saveShopCart = (cart: CartItem[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
};

export const upsertCartItem = (cart: CartItem[], item: CartItem) => {
  const existing = cart.find((entry) => entry.productId === item.productId);
  if (!existing) {
    return [...cart, { ...item, quantity: Math.min(item.quantity, item.stock) }];
  }

  return cart.map((entry) =>
    entry.productId === item.productId
      ? {
          ...entry,
          ...item,
          quantity: Math.min(entry.quantity + item.quantity, item.stock)
        }
      : entry
  );
};

export const updateCartItemQuantity = (cart: CartItem[], productId: number, quantity: number) => {
  if (quantity <= 0) {
    return cart.filter((entry) => entry.productId !== productId);
  }

  return cart.map((entry) =>
    entry.productId === productId
      ? { ...entry, quantity: Math.min(quantity, entry.stock) }
      : entry
  );
};

export const removeCartItem = (cart: CartItem[], productId: number) => {
  return cart.filter((entry) => entry.productId !== productId);
};

export const cartSubtotal = (cart: CartItem[]) => {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

export const cartCount = (cart: CartItem[]) => {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
};