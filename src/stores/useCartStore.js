import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
    cart: [],

    // Add item to cart
    addToCart: (product, quantity = 1) => {
        set((state) => {
            const existingIndex = state.cart.findIndex((p) => p.id === product.id);
            if (existingIndex >= 0) {
                // Item exists, update quantity
                const updatedCart = [...state.cart];
                updatedCart[existingIndex] = {
                    ...updatedCart[existingIndex],
                    quantity: updatedCart[existingIndex].quantity + quantity,
                };
                return { cart: updatedCart };
            } else {
                // New item
                return {
                    cart: [
                        ...state.cart,
                        {
                            ...product,
                            quantity: quantity,
                            unit: product.unit_type || 'ชิ้น',
                            image: product.image_url, // Standardize image key if needed
                        },
                    ],
                };
            }
        });
    },

    // Remove item from cart
    removeFromCart: (productId) => {
        set((state) => ({
            cart: state.cart.filter((p) => p.id !== productId),
        }));
    },

    // Update quantity directly
    updateQuantity: (productId, quantity) => {
        set((state) => ({
            cart: state.cart.map((p) =>
                p.id === productId ? { ...p, quantity: quantity } : p
            ),
        }));
    },

    // Clear cart
    clearCart: () => {
        set({ cart: [] });
    },

    // Get total items count
    getTotalItems: () => {
        return get().cart.length;
    },

    // Get total price
    getTotalAmount: () => {
        return get().cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
}));
