import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert } from "react-native";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { supabase } from "../services/supabase";
import { apiRequest, setCurrentStoreId, setCurrentUserId } from "../services/api";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen({ onLogin, onNavigateToSignUp, onNavigateToForgotPassword }) {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

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

                    // Fetch Profile & Stores (Same logic as handleSignIn)
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

                    if (onLogin) {
                        onLogin({
                            user: user,
                            profile: profile,
                            stores: userStores,
                        });
                    }
                };
                await createSessionFromUrl(url);
            }
        } catch (error) {
            Alert.alert("Google Login Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignIn = async () => {

        if (!email || !password) {
            Alert.alert('ข้อผิดพลาด', 'กรุณากรอกอีเมลและรหัสผ่าน');
            return;
        }

        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            setLoading(false);
            Alert.alert('เข้าสู่ระบบไม่สำเร็จ', error.message);
            return;
        }

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
                // Set context for API call
                setCurrentStoreId(userStores[0].id);
                setCurrentUserId(data.user.id);

                // Call recovery silently
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
            Alert.alert('เกิดข้อผิดพลาด', error.message);
        }
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
                    <Text style={{ fontSize: 16, color: '#fff' }}>ระบบจัดการร้านค้า</Text>
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
                        <Text style={{ fontSize: 16, marginTop: 5 }}>ยินดีต้อนรับกลับมา</Text>
                    </View>
                    <View style={{ paddingHorizontal: 20 }}>
                        <View style={{ marginBottom: 15 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8 }}>อีเมล</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="email-outline" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="your@email.com"
                                        style={{ fontSize: 16 }}
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
                            <Text style={{ fontWeight: '800', marginBottom: 8 }}>รหัสผ่าน</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name="lock" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="••••••••••"
                                        style={{ fontSize: 16 }}
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
                                <Text style={{ fontWeight: '700' }}>ลืมรหัสผ่าน?</Text>
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
                            <Text style={{ fontWeight: '600', fontSize: 16 }}>เข้าสู่ระบบด้วย Google</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                            <Text>ยังไม่มีบัญชี? </Text>
                            <TouchableOpacity onPress={onNavigateToSignUp}>
                                <Text style={{ fontWeight: '700' }}>สมัครสมาชิก</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    )
}