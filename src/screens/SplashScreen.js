import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Image,
    Animated,
    Easing,
    StyleSheet,
    Dimensions,
    StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
    // Animations
    const logoScale   = useRef(new Animated.Value(0.75)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoY       = useRef(new Animated.Value(20)).current;

    const textOpacity = useRef(new Animated.Value(0)).current;
    const textY       = useRef(new Animated.Value(14)).current;

    const subtitleOpacity = useRef(new Animated.Value(0)).current;
    const subtitleY       = useRef(new Animated.Value(10)).current;

    const footerOpacity = useRef(new Animated.Value(0)).current;
    const screenOpacity = useRef(new Animated.Value(1)).current;

    // Dot animations
    const dot1 = useRef(new Animated.Value(0.2)).current;
    const dot2 = useRef(new Animated.Value(0.2)).current;
    const dot3 = useRef(new Animated.Value(0.2)).current;

    // แยก image opacity ออกจาก badge เพื่อให้ fade แยกกันตอน exit
    const logoImageOpacity = useRef(new Animated.Value(0)).current;

    const smooth = (duration) => ({
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
    });

    useEffect(() => {
        // เริ่มหลัง 200ms ให้จอ render เสร็จก่อน
        const startDelay = setTimeout(() => {
            Animated.sequence([
                // 1. Logo slide-up + scale + fade in
                Animated.parallel([
                    Animated.timing(logoOpacity,      { toValue: 1, ...smooth(600) }),
                    Animated.timing(logoImageOpacity, { toValue: 1, ...smooth(600) }),
                    Animated.timing(logoScale,        { toValue: 1, ...smooth(700) }),
                    Animated.timing(logoY,            { toValue: 0, ...smooth(700) }),
                ]),
                // 2. Title slide-up + fade in
                Animated.parallel([
                    Animated.timing(textOpacity, { toValue: 1, ...smooth(550) }),
                    Animated.timing(textY,       { toValue: 0, ...smooth(550) }),
                ]),
                // 3. Subtitle + dots slide-up + fade in
                Animated.parallel([
                    Animated.timing(subtitleOpacity, { toValue: 1, ...smooth(500) }),
                    Animated.timing(subtitleY,       { toValue: 0, ...smooth(500) }),
                ]),
                // 4. Footer fade in ช้าๆ
                Animated.timing(footerOpacity, { toValue: 1, ...smooth(700) }),
            ]).start();
        }, 200);

        // Dots pulsing loop — ช้าลง ดูผ่อนคลาย
        const pulseDot = (dot, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 550,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(dot, {
                        toValue: 0.2,
                        duration: 550,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );

        const dotsAnim = Animated.parallel([
            pulseDot(dot1, 0),
            pulseDot(dot2, 280),
            pulseDot(dot3, 560),
        ]);
        dotsAnim.start();

        // Exit sequence: logo image หายก่อน → แล้ว badge + ทุกอย่างหายตาม
        const timer = setTimeout(() => {
            Animated.sequence([
                // Step 1: logo image fade ออกก่อน (300ms)
                Animated.timing(logoImageOpacity, {
                    toValue: 0,
                    duration: 300,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                // Step 2: หยุด 150ms ให้ badge ยังโชว์อยู่
                Animated.delay(150),
                // Step 3: ทุกอย่าง (รวม badge) fade ออก
                Animated.timing(screenOpacity, {
                    toValue: 0,
                    duration: 700,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(() => {
                dotsAnim.stop();
                onFinish?.();
            });
        }, 4500);

        return () => {
            clearTimeout(startDelay);
            clearTimeout(timer);
        };
    }, []);

    return (
        <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* Background blobs */}
            <View style={styles.blobTopLeft} />
            <View style={styles.blobTopRight} />

            {/* Center content */}
            <View style={styles.centerContent}>
                {/* Logo */}
                <Animated.View
                    style={[
                        styles.logoWrapper,
                        {
                            opacity: logoOpacity,
                            transform: [{ scale: logoScale }, { translateY: logoY }],
                        },
                    ]}
                >
                    <View style={styles.logoGlow} />
                    <Animated.View style={[styles.logoContainer, { opacity: logoImageOpacity }]}>
                        <Image
                            source={require('../../assets/logo.png')}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </Animated.View>
                    <View style={styles.badge}>
                        <MaterialCommunityIcons name="star-four-points" size={11} color="#fff" />
                    </View>
                </Animated.View>

                {/* App name */}
                <Animated.Text
                    style={[
                        styles.appName,
                        { opacity: textOpacity, transform: [{ translateY: textY }] },
                    ]}
                >
                    ชำ-ชำนาญ
                </Animated.Text>

                {/* Subtitle */}
                <Animated.View
                    style={[
                        styles.subtitleRow,
                        { opacity: subtitleOpacity, transform: [{ translateY: subtitleY }] },
                    ]}
                >
                    <MaterialCommunityIcons name="star-four-points-outline" size={13} color="#F37021" />
                    <Text style={styles.subtitle}>  AI-Powered POS Assistant  </Text>
                    <MaterialCommunityIcons name="star-four-points-outline" size={13} color="#F37021" />
                </Animated.View>

                {/* Loading dots */}
                <Animated.View style={[styles.dotsRow, { opacity: subtitleOpacity }]}>
                    <Animated.View style={[styles.dot, { opacity: dot1 }]} />
                    <Animated.View style={[styles.dot, { opacity: dot2 }]} />
                    <Animated.View style={[styles.dot, { opacity: dot3 }]} />
                </Animated.View>
            </View>

            {/* Footer */}
            <Animated.Text style={[styles.footer, { opacity: footerOpacity }]}>
                Smart Inventory • AI Recommendations • Easy Sales
            </Animated.Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF6F1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    blobTopLeft: {
        position: 'absolute',
        top: -80,
        left: -80,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(243, 112, 33, 0.08)',
    },
    blobTopRight: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(243, 200, 150, 0.12)',
    },
    centerContent: {
        alignItems: 'center',
    },
    logoWrapper: {
        marginBottom: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 34,
        backgroundColor: 'rgba(243, 112, 33, 0.12)',
        transform: [{ scale: 1.3 }],
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 28,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
        overflow: 'hidden',
    },
    logoImage: {
        width: 100,
        height: 100,
    },
    badge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#F37021',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FAF6F1',
        shadowColor: '#F37021',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 4,
    },
    appName: {
        fontSize: 36,
        fontWeight: '800',
        color: '#1A1A1A',
        letterSpacing: -0.5,
        marginBottom: 10,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 36,
    },
    subtitle: {
        fontSize: 13.5,
        color: '#666',
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#F37021',
    },
    footer: {
        position: 'absolute',
        bottom: 48,
        fontSize: 11.5,
        color: '#B0A898',
        letterSpacing: 0.2,
        fontWeight: '400',
    },
});
