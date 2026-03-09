import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert } from "react-native";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from "../services/supabase";

const MAX_NAME_LENGTH = 100;

function sanitizeName(name) {
    // ลบ HTML tags และอักขระ script ที่เป็นอันตราย
    return name.replace(/<[^>]*>/g, '').replace(/[<>"'`;]/g, '').trim();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function translateSignUpError(message) {
    if (!message) return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
    const m = message.toLowerCase();
    if (m.includes('user already registered') || m.includes('already registered') || m.includes('already exists'))
        return 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น';
    if (m.includes('password should be at least'))
        return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    if (m.includes('invalid email') || m.includes('unable to validate email'))
        return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (m.includes('network request failed') || m.includes('failed to fetch') || m.includes('networkerror'))
        return 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่';
    return 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}

export default function SignUpScreen({ onSignUp, onNavigateToSignIn }) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        if(!fullName || !email || !password || !confirmPassword){
            Alert.alert('ข้อมูลไม่ครบ','กรุณากรอกข้อมูลให้ครบทุกช่อง');
            return;
        }

        const cleanName = sanitizeName(fullName);
        if (!cleanName) {
            Alert.alert('ชื่อไม่ถูกต้อง', 'กรุณากรอกชื่อที่ถูกต้อง');
            return;
        }
        if (cleanName.length > MAX_NAME_LENGTH) {
            Alert.alert('ชื่อยาวเกินไป', `ชื่อต้องไม่เกิน ${MAX_NAME_LENGTH} ตัวอักษร`);
            return;
        }

        if (!isValidEmail(email)) {
            Alert.alert('อีเมลไม่ถูกต้อง', 'กรุณากรอกอีเมลให้ถูกต้อง เช่น example@email.com');
            return;
        }

        if(password !== confirmPassword){
            Alert.alert('รหัสผ่านไม่ตรงกัน','กรุณากรอกรหัสผ่านให้ตรงกันทั้งสองช่อง');
            return;
        }
        if(password.length < 6){
            Alert.alert('รหัสผ่านสั้นเกินไป','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            return;
        }

        setLoading(true);
        let data, error;
        try {
            ({ data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
            }));
        } catch (networkErr) {
            setLoading(false);
            Alert.alert('สมัครสมาชิกไม่สำเร็จ', 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
            return;
        }

        if(error){
            setLoading(false);
            Alert.alert('สมัครสมาชิกไม่สำเร็จ', translateSignUpError(error.message));
            return;
        }

        if(data.user){
            const {error:updateError} = await supabase
                .from('profiles')
                .update({ full_name: cleanName })
                .eq('id', data.user.id);
            if(updateError){
                console.log('Update profile error:',updateError.message);
            }
        }
        setLoading(false);

        Alert.alert('สมัครสมาชิกสำเร็จ','สร้างบัญชีเรียบร้อยแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีของคุณ', [
            { text: 'ตกลง', onPress: () => onSignUp && onSignUp() }
        ]);
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
            <View style={{ flex: 2.5, backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 8 }}>
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ paddingTop: 25, paddingBottom: 15, alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, fontWeight: '800' }}>สมัครสมาชิก</Text>
                        <Text style={{ fontSize: 18, marginTop: 5 }}>สร้างบัญชีใหม่</Text>
                    </View>
                    <View style={{ paddingHorizontal: 20 }}>
                        <View style={{ marginBottom: 15 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8, fontSize: 18 }}>ชื่อผู้ใช้</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name="user" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="ชื่อ-นามสกุล"
                                        style={{ fontSize: 18 }}
                                        value={fullName}
                                        onChangeText={setFullName}
                                        editable={!loading}
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={{ marginBottom: 15 }}>
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
                        <View style={{ marginBottom: 15 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8, fontSize: 18 }}>รหัสผ่าน</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name="lock" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="••••••••••"
                                        style={{ fontSize: 18 }}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        editable={!loading}
                                    />
                                </View>
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name={showPassword ? "eye" : "eye-off"} size={24} color="#989898" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8, fontSize: 18 }}>ยืนยันรหัสผ่าน</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name="lock" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="••••••••••"
                                        style={{ fontSize: 18 }}
                                        secureTextEntry={!showConfirmPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        editable={!loading}
                                    />
                                </View>
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={24} color="#989898" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity 
                            onPress={handleSignUp} 
                            disabled={loading}
                            style={{ height: 50, backgroundColor: '#1E2022', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff"/>
                            ):(
                                <Text style={{ fontWeight: '700', color: '#fff', fontSize: 18 }}>สมัครสมาชิก</Text>
                            )}
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                            <Text style={{fontSize: 18 }}>มีบัญชีแล้ว? </Text>
                            <TouchableOpacity onPress={onNavigateToSignIn}>
                                <Text style={{ fontWeight: '700', fontSize: 18 }}>เข้าสู่ระบบ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    )
}