import { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert, Modal } from "react-native";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { supabase } from "../services/supabase";
import { apiRequest, setCurrentStoreId, setCurrentUserId } from "../services/api";

WebBrowser.maybeCompleteAuthSession();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 นาที

function translateAuthError(message) {
    if (!message) return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
    const m = message.toLowerCase();
    if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
        return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (m.includes('email not confirmed'))
        return 'กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ';
    if (m.includes('network request failed') || m.includes('failed to fetch') || m.includes('networkerror'))
        return 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่';
    if (m.includes('too many requests') || m.includes('rate limit'))
        return 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    if (m.includes('user not found'))
        return 'ไม่พบบัญชีผู้ใช้นี้ในระบบ';
    return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function SignInScreen({ onLogin, onNavigateToSignUp, onNavigateToForgotPassword }) {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const loginAttempts = useRef(0);
    const lockedUntil = useRef(null);

    // Profile completion modal state
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [modalName, setModalName] = useState('');
    const [modalAvatarUrl, setModalAvatarUrl] = useState(null);
    const [modalSaving, setModalSaving] = useState(false);
    const pendingLogin = useRef(null);

    const completeLogin = (user, profile, stores) => {
        if (onLogin) onLogin({ user, profile, stores });
    };

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);

            const redirectTo = makeRedirectUri();
            console.log('Redirecting to:', redirectTo);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });
            if (error) throw error;
            console.log('Supabase Auth URL:', data.url);
            const res = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectTo
            );

            if (res.type === "success") {
                const { url } = res;
                const createSessionFromUrl = async (url) => {
                    const { params, errorCode } = QueryParams.getQueryParams(url);

                    if (errorCode) throw Error(errorCode);

                    const { access_token, refresh_token } = params;

                    if (!access_token) return;

                    const { data: { user }, error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    });
                    if (error) throw error;

                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();
                    if (profileError) throw profileError;

                    let userStores = [];
                    if (profile.role === 'owner') {
                        const { data: ownedStores } = await supabase
                            .from('stores')
                            .select('*')
                            .eq('owner_id', user.id)
                            .eq('is_active', true);
                        userStores = ownedStores || [];
                    } else {
                        const { data: memberData } = await supabase
                            .from('store_members')
                            .select('store_id, stores(*)')
                            .eq('user_id', user.id)
                            .single();
                        if (memberData?.stores) {
                            userStores = [memberData.stores];
                        }
                    }

                    // ถ้ายังไม่มีชื่อในโปรไฟล์ → แสดง modal ให้กรอก
                    if (!profile.full_name) {
                        const googleName = user.user_metadata?.full_name
                            || user.user_metadata?.name
                            || '';
                        const googleAvatar = user.user_metadata?.avatar_url
                            || user.user_metadata?.picture
                            || null;

                        pendingLogin.current = { user, profile, stores: userStores };
                        setModalName(googleName);
                        setModalAvatarUrl(googleAvatar);
                        setShowProfileModal(true);
                    } else {
                        completeLogin(user, profile, userStores);
                    }
                };
                await createSessionFromUrl(url);
            }
        } catch (error) {
            const msg = error?.message?.toLowerCase() || '';
            if (msg.includes('network') || msg.includes('fetch')) {
                Alert.alert('เข้าสู่ระบบด้วย Google ไม่สำเร็จ', 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
            } else {
                Alert.alert('เข้าสู่ระบบด้วย Google ไม่สำเร็จ', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleProfileSkip = () => {
        setShowProfileModal(false);
        const { user, profile, stores } = pendingLogin.current;
        pendingLogin.current = null;
        completeLogin(user, profile, stores);
    };

    const handleProfileConfirm = async () => {
        const trimmedName = modalName.trim().replace(/<[^>]*>/g, '').replace(/[<>"'`;]/g, '');
        if (!trimmedName) {
            Alert.alert('กรุณากรอกชื่อ', 'ชื่อต้องไม่เว้นว่างไว้ หรือกด "ข้าม" เพื่อทำต่อโดยไม่ตั้งชื่อ');
            return;
        }
        if (trimmedName.length > 100) {
            Alert.alert('ชื่อยาวเกินไป', 'ชื่อต้องไม่เกิน 100 ตัวอักษร');
            return;
        }

        setModalSaving(true);
        try {
            const { user, profile, stores } = pendingLogin.current;
            const updateData = { full_name: trimmedName };
            if (modalAvatarUrl) updateData.avatar_url = modalAvatarUrl;

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id);

            if (error) throw error;

            setShowProfileModal(false);
            pendingLogin.current = null;
            completeLogin(user, { ...profile, full_name: trimmedName, avatar_url: modalAvatarUrl }, stores);
        } catch (err) {
            const m = err?.message?.toLowerCase() || '';
            if (m.includes('network') || m.includes('fetch')) {
                Alert.alert('บันทึกไม่สำเร็จ', 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
            } else {
                Alert.alert('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
            }
        } finally {
            setModalSaving(false);
        }
    };

    const handleSignIn = async () => {
        // ตรวจสอบว่าถูกล็อกอยู่หรือไม่
        if (lockedUntil.current && Date.now() < lockedUntil.current) {
            const remaining = Math.ceil((lockedUntil.current - Date.now()) / 60000);
            Alert.alert('บัญชีถูกระงับชั่วคราว', `พยายามเข้าสู่ระบบผิดพลาดหลายครั้งเกินไป กรุณารอ ${remaining} นาทีแล้วลองใหม่`);
            return;
        }

        if (!email || !password) {
            Alert.alert('ข้อผิดพลาด', 'กรุณากรอกอีเมลและรหัสผ่าน');
            return;
        }

        if (!isValidEmail(email)) {
            Alert.alert('ข้อผิดพลาด', 'รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลให้ถูกต้อง');
            return;
        }

        setLoading(true);

        let data, error;
        try {
            ({ data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            }));
        } catch (networkErr) {
            setLoading(false);
            Alert.alert('เข้าสู่ระบบไม่สำเร็จ', 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
            return;
        }

        if (error) {
            setLoading(false);
            loginAttempts.current += 1;
            if (loginAttempts.current >= MAX_LOGIN_ATTEMPTS) {
                lockedUntil.current = Date.now() + LOCKOUT_DURATION_MS;
                loginAttempts.current = 0;
                Alert.alert('บัญชีถูกระงับชั่วคราว', 'พยายามเข้าสู่ระบบผิดพลาดหลายครั้งเกินไป กรุณารอ 5 นาทีแล้วลองใหม่');
            } else {
                const remaining = MAX_LOGIN_ATTEMPTS - loginAttempts.current;
                Alert.alert('เข้าสู่ระบบไม่สำเร็จ', `${translateAuthError(error.message)} (เหลืออีก ${remaining} ครั้งก่อนถูกระงับชั่วคราว)`);
            }
            return;
        }

        // เข้าสู่ระบบสำเร็จ รีเซ็ตนับครั้ง
        loginAttempts.current = 0;
        lockedUntil.current = null;

        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
            if (profileError) throw profileError;

            let userStores = [];

            const { data: session } = await supabase.auth.getSession();
            console.log('Session:', session);
            console.log('User from session:', session?.session?.user?.id)

            if (profile.role === 'owner') {
                const { data: ownedStores } = await supabase
                    .from('stores')
                    .select('*')
                    .eq('owner_id', data.user.id)
                    .eq('is_active', true);
                userStores = ownedStores || [];
                console.log('Owned stores:', userStores);
            } else {
                const { data: memberData } = await supabase
                    .from('store_members')
                    .select('store_id, stores(*)')
                    .eq('user_id', data.user.id)
                    .single();
                if (memberData?.stores) {
                    userStores = [memberData.stores];
                }
            }
            setLoading(false);

            // Auto-Fix: Claim Orphans if Owner
            if (profile.role === 'owner' && userStores.length > 0) {
                setCurrentStoreId(userStores[0].id);
                setCurrentUserId(data.user.id);
                apiRequest('/admin/claim-orphans', { method: 'POST' })
                    .then(res => console.log('Recovery result:', res))
                    .catch(err => console.log('Recovery failed:', err));
            }

            if (onLogin) {
                onLogin({
                    user: data.user,
                    profile: profile,
                    stores: userStores,
                });
            }

        } catch (error) {
            setLoading(false);
            const msg = error?.message?.toLowerCase() || '';
            if (msg.includes('network') || msg.includes('fetch')) {
                Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
            } else {
                Alert.alert('เกิดข้อผิดพลาด', 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
            }
        }
    };

    return (
        <>
        {/* ===== Modal เสร็จสิ้นโปรไฟล์ Google ===== */}
        <Modal
            visible={showProfileModal}
            transparent
            animationType="fade"
            onRequestClose={handleProfileSkip}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.55)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 24,
            }}>
                <View style={{
                    backgroundColor: '#fff',
                    borderRadius: 20,
                    width: '100%',
                    paddingTop: 0,
                    paddingBottom: 28,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 10,
                    overflow: 'hidden',
                }}>
                    {/* แถบบน */}
                    <View style={{ backgroundColor: '#52616B', paddingVertical: 20, alignItems: 'center' }}>
                        {/* รูปโปรไฟล์ */}
                        <View style={{
                            width: 90, height: 90, borderRadius: 45,
                            borderWidth: 3, borderColor: '#fff',
                            overflow: 'hidden',
                            backgroundColor: '#C4CDD5',
                            justifyContent: 'center', alignItems: 'center',
                        }}>
                            {modalAvatarUrl ? (
                                <Image
                                    source={{ uri: modalAvatarUrl }}
                                    style={{ width: 90, height: 90 }}
                                />
                            ) : (
                                <Feather name="user" size={40} color="#fff" />
                            )}
                        </View>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, marginTop: 10 }}>
                            ยินดีต้อนรับ!
                        </Text>
                        <Text style={{ color: '#dce3e8', fontSize: 18, marginTop: 2 }}>
                            ตั้งชื่อที่แสดงในแอปของคุณ
                        </Text>
                    </View>

                    <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                        <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8, color: '#333' }}>
                            ชื่อที่ต้องการแสดง
                        </Text>
                        <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: '#f5f6f7',
                            borderRadius: 10, paddingHorizontal: 14,
                            height: 50, borderWidth: 1, borderColor: '#e0e0e0',
                            marginBottom: 8,
                        }}>
                            <Feather name="user" size={18} color="#aaa" style={{ marginRight: 10 }} />
                            <TextInput
                                style={{ flex: 1, fontSize: 18, color: '#222' }}
                                placeholder="กรอกชื่อของคุณ"
                                placeholderTextColor="#bbb"
                                value={modalName}
                                onChangeText={setModalName}
                                maxLength={100}
                                editable={!modalSaving}
                                autoFocus
                            />
                        </View>
                        <Text style={{ fontSize: 18, color: '#aaa', marginBottom: 22 }}>
                            ชื่อนี้จะแสดงให้ผู้อื่นเห็นในระบบ แก้ไขได้ภายหลังในหน้าโปรไฟล์
                        </Text>

                        {/* ปุ่ม */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={handleProfileSkip}
                                disabled={modalSaving}
                                style={{
                                    flex: 1, height: 48, borderRadius: 10,
                                    borderWidth: 1.5, borderColor: '#ccc',
                                    justifyContent: 'center', alignItems: 'center',
                                    backgroundColor: '#fff',
                                }}
                            >
                                <Text style={{ fontSize: 18, fontWeight: '600', color: '#666' }}>ข้าม</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleProfileConfirm}
                                disabled={modalSaving}
                                style={{
                                    flex: 2, height: 48, borderRadius: 10,
                                    backgroundColor: '#1E2022',
                                    justifyContent: 'center', alignItems: 'center',
                                }}
                            >
                                {modalSaving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>ยืนยัน</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>

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
            <View style={{ flex: 2, backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 8 }}>
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ paddingTop: 25, paddingBottom: 15, alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, fontWeight: '800' }}>เข้าสู่ระบบ</Text>
                        <Text style={{ fontSize: 18, marginTop: 5 }}>ยินดีต้อนรับกลับมา</Text>
                    </View>
                    <View style={{ paddingHorizontal: 20 }}>
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
                        <View style={{ marginBottom: 10 }}>
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
                        <View style={{ alignItems: 'flex-end', marginBottom: 20 }}>
                            <TouchableOpacity onPress={onNavigateToForgotPassword}>
                                <Text style={{ fontWeight: '700', fontSize: 16 }}>ลืมรหัสผ่าน?</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={handleSignIn}
                            style={{ height: 50, backgroundColor: '#1E2022', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={{ fontWeight: '700', color: '#fff', fontSize: 18 }}>เข้าสู่ระบบ</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleGoogleLogin}
                            style={{
                                flexDirection: 'row',
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: '#ddd',
                                padding: 10,
                                borderRadius: 10,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 20
                            }}
                        >
                            {/* Google Logo 2025 */}
                            <Image
                                source={{ uri: 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                                style={{ width: 24, height: 24, marginRight: 10 }}
                            />
                            <Text style={{ fontWeight: '600', fontSize: 18 }}>เข้าสู่ระบบด้วย Google</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                            <Text style ={{fontSize: 18}}>ยังไม่มีบัญชี? </Text>
                            <TouchableOpacity onPress={onNavigateToSignUp}>
                                <Text style={{ fontWeight: '700', fontSize: 18 }}>สมัครสมาชิก</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
        </>
    )
}