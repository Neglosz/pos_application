import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Official Supabase React Native approach
// เรียก startAutoRefresh() ตอน load ทันที (cold start ด้วย)
supabase.auth.startAutoRefresh();

// จัดการตาม AppState
// หยุดเฉพาะตอน 'background' เท่านั้น — ไม่หยุดตอน 'inactive'
// เพราะ 'inactive' เกิดชั่วคราว (รับสาย, ล็อคหน้าจอ, notification)
// ถ้าหยุดตอน inactive แล้วผู้ใช้อยู่นอกจอ >1 ชั่วโมง token จะหมดอายุโดยไม่มีการ refresh
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else if (state === 'background') {
        supabase.auth.stopAutoRefresh();
    }
    // 'inactive' → ไม่ทำอะไร ปล่อย timer วิ่งต่อ
});