import { API_BASE_URL as BASE_URL } from '../config';
import { supabase } from './supabase';

let currentStoreId = null;
let currentUserId = null;

export const apiRequest = async (endpoint, options = {}) => {
    let token = null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
    } catch (error) {
        console.error("Error fetching session:", error);
    }

    const headers = {
        'Content-Type': 'application/json',
        ...(currentStoreId && { 'x-store-id': currentStoreId }),
        ...(currentUserId && { 'x-user-id': currentUserId }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
    };

    let response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401 || response.status === 403) {
        console.log("Token expired from Backend Request. Trying silent refresh...");
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session) {
            console.log("Refresh failed, kicking user to login.");
            await supabase.auth.signOut();
            return { success: false, error: 'Session expired permanently' };
        }

        const newHeaders = {
            ...headers,
            'Authorization': `Bearer ${refreshData.session.access_token}`
        };

        response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers: newHeaders,
        });
    }

    return response.json();
}

export const setCurrentStoreId = (storeId) => {
    currentStoreId = storeId;
};

export const setCurrentUserId = (userId) => {
    currentUserId = userId;
};

export const getCurrentStoreId = () => currentStoreId;
export const getCurrentUserId = () => currentUserId;

// Stock APIs
export const getStockStats = async () => {
    return apiRequest('/stock/stats');
};

export const getNearExpiryItems = async () => {
    return apiRequest('/stock/near-expiry');
};

export const getExpiredItems = async () => {
    return apiRequest('/stock/expired');
};

export const getLowStockItems = async () => {
    return apiRequest('/stock/low-stock');
};

export const getOutOfStockItems = async () => {
    return apiRequest('/stock/out-of-stock');
};

export const checkStockNotifications = async () => {
    return apiRequest('/stock/check-notifications', { method: 'POST' });
};

export const getCustomersWithDebt = async () => {
    const response = await apiRequest('/customers/with-debt');
    if (response.success && response.data) {
        // Cache debtors for offline use
        // Note: The response structure might need mapping if it differs from search results
        // Assuming data is an array of customers
        useCustomerStore.getState().addCustomers(response.data);
    }
    return response;
};

export const getCustomerPendingBills = async (customerId) => {
    return apiRequest(`/customers/${customerId}/pending-bills`);
};

export const updateCustomer = async (customerId, customerData) => {
    return apiRequest(`/customers/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify(customerData),
    });
};

export const deleteCustomer = async (customerId) => {
    return apiRequest(`/customers/${customerId}`, {
        method: 'DELETE',
    });
};

export const createCreditPayment = async (paymentData) => {
    return apiRequest('/credit-payments', {
        method: 'POST',
        body: JSON.stringify(paymentData),
    });
};

export const getNotifications = async (category = null) => {
    let endpoint = `/notifications`;
    if (category) {
        endpoint += `?category=${encodeURIComponent(category)}`;
    }
    return apiRequest(endpoint);
};

export const getUnreadNotificationCount = async () => {
    return apiRequest('/notifications/unread-count');
};

import { useOfflineStore } from '../stores/useOfflineStore';
import { useCustomerStore } from '../stores/useCustomerStore';

export const createCreditSale = async (saleData) => {
    // Check Offline Mode
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
        console.log("OFFLINE MODE: Queuing Credit Sale");
        const tempId = `OFF-${Date.now()}`;
        const offlineSale = {
            ...saleData,
            tempId,
            status: 'pending',
            created_at: new Date().toISOString(),
            isCredit: true
        };
        useOfflineStore.getState().addPendingSale(offlineSale);

        // Return Mock Data Structure matching Backend Response
        return {
            success: true,
            data: {
                id: tempId,
                order_no: tempId,
                isOffline: true,
                created_at: new Date().toISOString(),
                total_amount: saleData.amount,
                customer: { name: saleData.customer_name },
                order_items: saleData.items.map(p => ({
                    products: { name: p.name },
                    qty: p.quantity,
                    price_per_unit: p.price,
                    unit: p.unit || p.unit_type || 'ชิ้น'
                }))
            }
        };
    }

    return apiRequest('/credit-sales', {
        method: 'POST',
        body: JSON.stringify(saleData),
    });
};

export const createSale = async (saleData) => {
    // Check Offline Mode
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
        console.log("OFFLINE MODE: Queuing Sale");
        const tempId = `OFF-${Date.now()}`;
        const offlineSale = {
            ...saleData,
            tempId,
            status: 'pending',
            created_at: new Date().toISOString(),
            isCredit: false
        };
        useOfflineStore.getState().addPendingSale(offlineSale);

        // Return Mock Data Structure matching Backend Response
        return {
            success: true,
            data: {
                id: tempId,
                order_no: tempId,
                isOffline: true,
                created_at: new Date().toISOString(),
                total_amount: saleData.receivedAmount || saleData.totalAmount || 0,
                // store: { name: 'Offline Store' }, // Optional
                stores: { name: 'Offline Store' },
                order_items: saleData.items.map(p => ({
                    products: { name: p.name },
                    qty: p.quantity,
                    price_per_unit: p.price,
                    unit: p.unit || p.unit_type || 'ชิ้น'
                }))
            }
        };
    }

    return apiRequest('/sales', {
        method: 'POST',
        body: JSON.stringify(saleData),
    });
};

export const checkDueNotifications = async () => {
    return apiRequest('/check-due-notifications', {
        method: 'POST',
    });
}

// Run daily check for expiry, payment due, promo ending notifications
export const runDailyCheck = async () => {
    return apiRequest('/notifications/daily-check', {
        method: 'POST',
    });
}

export const deleteNotification = async (id) => {
    return apiRequest(`/notifications/${id}`, {
        method: 'DELETE',
    });
};

export const markNotificationsAsRead = async (ids) => {
    return apiRequest('/notifications/mark-read', {
        method: 'PUT',
        body: JSON.stringify({ ids }),
    });
};

export const markNotificationAsRead = async (id) => {
    return apiRequest(`/notifications/${id}/read`, {
        method: 'PUT',
    });
};

export const searchCustomers = async (query) => {
    // Check Offline Mode
    const isOnline = useOfflineStore.getState().isOnline;
    if (!isOnline) {
        console.log("OFFLINE MODE: Searching local customers");
        const localResults = useCustomerStore.getState().searchLocal(query);
        return { success: true, data: localResults };
    }

    const response = await apiRequest(`/customers/search?q=${encodeURIComponent(query)}`);
    if (response.success && response.data) {
        // Cache results for offline use
        useCustomerStore.getState().addCustomers(response.data);
    }
    return response;
};

export const getProductCategories = async () => {
    return apiRequest('/product-categories');
};

export const addProductCategory = async (name) => {
    return apiRequest('/product-categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
};

export const updateProductCategory = async (id, name) => {
    return apiRequest(`/product-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
    });
};

export const deleteProductCategory = async (id) => {
    return apiRequest(`/product-categories/${id}`, {
        method: 'DELETE',
    });
};

// Lookup product by barcode
export const getProductByBarcode = async (barcode) => {
    return apiRequest(`/products/barcode/${encodeURIComponent(barcode)}`);
};

// Add new batch to existing product (restock)
export const addProductBatch = async (productId, batchData) => {
    return apiRequest(`/products/${productId}/add-batch`, {
        method: 'POST',
        body: JSON.stringify(batchData),
    });
};

// Store Settings & PromptPay
export const getStoreSettings = async (storeId = null) => {
    const options = {};
    if (storeId) {
        options.headers = { 'x-store-id': storeId };
    }
    return apiRequest('/stores/settings', options);
};

export const updateStoreSettings = async (settings, storeId = null) => {
    const options = {
        method: 'PUT',
        body: JSON.stringify(settings),
    };
    if (storeId) {
        options.headers = { 'x-store-id': storeId };
    }
    return apiRequest('/stores/settings', options);
};

export const getQRPayload = async (amount) => {
    return apiRequest('/sales/qr-payload', {
        method: 'POST',
        body: JSON.stringify({ amount }),
    });
};

export const addProduct = async (productData) => {
    // Prepare data - now expects imageUrl (Supabase URL) instead of local image URI
    const body = {
        code: productData.code,
        name: productData.name,
        quantity: productData.quantity,
        costPrice: productData.costPrice,
        salePrice: productData.salePrice,
        lowStockThreshold: productData.lowStockThreshold || 0,
        categoryId: productData.categoryId || null,
        unitType: productData.unitType || 'ชิ้น',
        imageUrl: productData.imageUrl || null, // Supabase Storage URL
    };

    if (productData.expireDate) {
        const day = productData.expireDate.getDate().toString().padStart(2, '0');
        const month = (productData.expireDate.getMonth() + 1).toString().padStart(2, '0');
        const year = productData.expireDate.getFullYear();
        body.expireDate = `${day}/${month}/${year}`;
    }

    return apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(body),
    });
};


// Reports
export const getSalesSummary = async (period = 'today') => {
    return apiRequest(`/reports/sales-summary?period=${period}`);
};

export const getSalesChartData = async (period = 'today') => {
    return apiRequest(`/reports/sales-chart?period=${period}`);
};

export const getPaymentMethodStats = async (period = 'today') => {
    return apiRequest(`/reports/payment-methods?period=${period}`);
};

export const getRecentOrders = async () => {
    return apiRequest('/reports/recent-orders');
};

export const getOrders = async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/orders?${query}`);
};

export const getOrderDetails = async (id) => {
    return apiRequest(`/orders/${id}`);
};

// Transactions / Expenses
export const getTransactions = async (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    return apiRequest(`/transactions?${queryParams}`);
};

export const createTransaction = async (data) => {
    return apiRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

// AI Endpoints (Legacy)
export const getAISuggestions = async (lat, lon) => {
    let endpoint = '/ai/suggestions';
    if (lat && lon) endpoint += `?lat=${lat}&lon=${lon}`;
    return apiRequest(endpoint);
};

export const sendAIChat = async (message, lat, lon, history = []) => {
    return apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, lat, lon, history }),
    });
};

// AI Recommendations (New)
export const getAIRecommendations = async (lat, lon) => {
    let endpoint = '/ai/recommendations';
    if (lat && lon) endpoint += `?lat=${lat}&lon=${lon}`;
    return apiRequest(endpoint);
};

export const takeRecommendationAction = async (id, action, actualOutcome = null, actualAmount = null) => {
    return apiRequest(`/ai/recommendations/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, actual_outcome: actualOutcome, actual_amount: actualAmount }),
    });
};

export const getRecommendationHistory = async (days = 30) => {
    return apiRequest(`/ai/recommendations/history?days=${days}`);
};

export const getRecommendationStats = async () => {
    return apiRequest('/ai/recommendations/stats');
};

// AI Action Endpoints
export const applyPromotion = async (recommendationId, productNames, discountPercent, daysValid = 3, promotionType = 'discount_percent', extraParams = {}) => {
    return apiRequest('/ai/apply-promotion', {
        method: 'POST',
        body: JSON.stringify({ recommendationId, productNames, discountPercent, daysValid, promotionType, ...extraParams })
    });
};

export const disposeProduct = async (recommendationId, productNames) => {
    return apiRequest('/ai/dispose-product', {
        method: 'POST',
        body: JSON.stringify({ recommendationId, productNames })
    });
};

export const getActivePromotions = async () => {
    return apiRequest('/ai/active-promotions');
};

export const deactivatePromotion = async (promotionId) => {
    return apiRequest(`/ai/promotions/${promotionId}/deactivate`, { method: 'PATCH' });
}

export const deleteTransaction = async (id) => {
    return apiRequest(`/transactions/${id}`, {
        method: 'DELETE',
    });
};
