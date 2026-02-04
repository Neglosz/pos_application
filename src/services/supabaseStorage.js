import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

/**
 * Supabase Storage Utility
 * จัดการอัพโหลด/ลบรูปไป Supabase Storage
 */

/**
 * อัพโหลดรูปสินค้าไป Supabase Storage (public bucket)
 * @param {string} uri - Local URI ของรูป
 * @param {string} storeId - Store ID สำหรับแยก folder
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const uploadProductImage = async (uri, storeId) => {
    try {
        if (!uri || !storeId) {
            return { success: false, error: 'Missing uri or storeId' };
        }

        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64',
        });

        // Generate unique filename
        const filename = `${storeId}/product-${Date.now()}.jpg`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('products')
            .upload(filename, decode(base64), {
                contentType: 'image/jpeg',
                upsert: false,
            });

        if (error) {
            console.error('Upload product image error:', error);
            return { success: false, error: error.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('products')
            .getPublicUrl(filename);

        return { success: true, url: urlData.publicUrl, path: filename };
    } catch (error) {
        console.error('uploadProductImage error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * อัพโหลดรูปลูกค้าไป Supabase Storage (private bucket)
 * @param {string} uri - Local URI ของรูป
 * @param {string} storeId - Store ID สำหรับแยก folder
 * @returns {Promise<{success: boolean, url?: string, path?: string, error?: string}>}
 */
export const uploadCustomerImage = async (uri, storeId) => {
    try {
        if (!uri || !storeId) {
            return { success: false, error: 'Missing uri or storeId' };
        }

        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64',
        });

        // Generate unique filename
        const filename = `${storeId}/customer-${Date.now()}.jpg`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('customers')
            .upload(filename, decode(base64), {
                contentType: 'image/jpeg',
                upsert: false,
            });

        if (error) {
            console.error('Upload customer image error:', error);
            return { success: false, error: error.message };
        }

        // For private bucket, we store the path and get signed URL when displaying
        // But for simplicity, we can also get public URL if bucket allows
        const { data: urlData } = supabase.storage
            .from('customers')
            .getPublicUrl(filename);

        return { success: true, url: urlData.publicUrl, path: filename };
    } catch (error) {
        console.error('uploadCustomerImage error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * ดึง Signed URL สำหรับ private bucket (customers)
 * @param {string} path - Path ของไฟล์ใน bucket
 * @param {number} expiresIn - เวลาหมดอายุ (วินาที) default 3600 = 1 ชม.
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const getSignedUrl = async (path, expiresIn = 3600) => {
    try {
        if (!path) {
            return { success: false, error: 'Missing path' };
        }

        const { data, error } = await supabase.storage
            .from('customers')
            .createSignedUrl(path, expiresIn);

        if (error) {
            console.error('getSignedUrl error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, url: data.signedUrl };
    } catch (error) {
        console.error('getSignedUrl error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * ลบรูปจาก Supabase Storage
 * @param {string} bucket - ชื่อ bucket ('products' หรือ 'customers')
 * @param {string} path - Path ของไฟล์ที่ต้องการลบ
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteImage = async (bucket, path) => {
    try {
        if (!bucket || !path) {
            return { success: false, error: 'Missing bucket or path' };
        }

        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) {
            console.error('deleteImage error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('deleteImage error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * ตรวจสอบว่า URL เป็น local URI หรือ Supabase URL
 * @param {string} uri 
 * @returns {boolean} true ถ้าเป็น local URI (ต้อง upload)
 */
export const isLocalUri = (uri) => {
    if (!uri) return false;
    return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/');
};
