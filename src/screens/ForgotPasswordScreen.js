import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert } from "react-native";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { supabase } from "../services/supabase";
import { useState } from "react";

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function ForgotPasswordScreen({ onNavigateToSignIn }) {

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleResetPassword = async () => {
        if(!email){
            Alert.alert('ข้อมูลไม่ครบ','กรุณากรอกอีเมลของคุณ');
            return;
        }
        if (!isValidEmail(email)) {
            Alert.alert('อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง เช่น example@email.com');
            return;
        }
        setLoading(true);

        let error;
        try {
            ({ error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: 'zippytill://reset-password'
            }));
        } catch (networkErr) {
            setLoading(false);
            Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
            return;
        }

        setLoading(false);
        if(error){
            const m = error.message.toLowerCase();
            if (m.includes('network') || m.includes('fetch')) {
                Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
            } else {
                Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง');
            }
            return;
        }
        // แสดงข้อความ generic เพื่อความปลอดภัย (ไม่บอกว่ามีอีเมลอยู่หรือไม่)
        Alert.alert(
            'ตรวจสอบอีเมลของคุณ',
            'หากอีเมลนี้มีบัญชีอยู่ในระบบ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้ กรุณาตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์สแปม)',
            [{ text: 'ตกลง', onPress: onNavigateToSignIn }]
        );
    };
    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#52616B' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={{ flex: 1, backgroundColor: '#52616B' }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Image style={{ width: 100, height: 100 }} source={{ uri: "https://i.postimg.cc/CMk3WcZs/Chat-GPT-Image-Jan-5-2026-12-04-50-AM-Photoroom.png" }} />
                    <Text style={{ fontSize: 30, fontWeight: '700', color: '#fff' }}>Zippy Till</Text>
                    <Text style={{ fontSize: 18, color: '#fff' }}>ระบบจัดการร้านค้า</Text>
                </View>
            </View>
            <View style={{ flex: 1.5, backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 8 }}>
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ paddingTop: 25, paddingBottom: 15, alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, fontWeight: '800' }}>ลืมรหัสผ่าน</Text>
                        <Text style={{ fontSize: 18, marginTop: 5 }}>กรอกอีเมลเพื่อรับลิงค์รีเซ็ต</Text>
                    </View>
                    <View style={{ paddingHorizontal: 20 }}>
                        <View style={{ marginBottom: 25 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8, fontSize: 18 }}>อีเมล</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="email-outline" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="your@email.com"
                                        style={{ fontSize: 18 }}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!loading}
                                    />
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={{ height: 50, backgroundColor: '#1E2022', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}
                            onPress={handleResetPassword}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color='#fff'/>
                            ):(
                                <Text style={{ fontWeight: '700', color: '#fff', fontSize: 18 }}>ส่งลิงค์รีเซ็ตรหัสผ่าน</Text>
                            )}
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                            <TouchableOpacity onPress={onNavigateToSignIn}>
                                <Text style={{ fontWeight: '700', fontSize: 18 }}>← กลับไปหน้าเข้าสู่ระบบ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    )
}