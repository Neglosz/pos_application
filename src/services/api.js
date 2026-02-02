import { API_BASE_URL as BASE_URL } from '../config';
import { supabase } from './supabase';

import { Alert } from 'react-native';

let currentStoreId = null;
let currentUserId = null;

const apiRequest = async (endpoint, options = {}) => {
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

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });
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
    return apiRequest('/customers/with-debt');
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

export const createCreditSale = async (saleData) => {
    return apiRequest('/credit-sales', {
        method: 'POST',
        body: JSON.stringify(saleData),
    });
};

export const createSale = async (saleData) => {
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
    return apiRequest(`/customers/search?q=${encodeURIComponent(query)}`);
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

export const deleteTransaction = async (id) => {
    return apiRequest(`/transactions/${id}`, {
        method: 'DELETE',
    });
};
