import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function BottomNav({ activeTab = 'ค้างชำระ', onTabPress }) {
    const tabs = [
        { name: 'ผู้ช่วย', icon: 'robot-outline', activeIcon: 'robot', iconType: 'material' },
        { name: 'คลัง', icon: 'cube-outline', activeIcon: 'cube', iconType: 'ionicons' },
        { name: 'สแกน', icon: 'barcode-scan', iconType: 'material', isCenter: true },
        { name: 'ค้างชำระ', icon: 'people-outline', activeIcon: 'people', iconType: 'ionicons' },
        { name: 'รายงาน', icon: 'grid-outline', activeIcon: 'grid', iconType: 'ionicons' },
    ];

    const renderIcon = (tab, isActive) => {
        const color = isActive ? '#e9751dff' : '#999';
        const size = tab.isCenter ? 32 : 28;
        const iconName = (isActive && tab.activeIcon) ? tab.activeIcon : tab.icon;

        if (tab.iconType === 'material') {
            return <MaterialCommunityIcons name={iconName} size={size} color={tab.isCenter ? '#fff' : color} />;
        }
        return <Ionicons name={iconName} size={size} color={color} />;
    };

    return (
        <View style={styles.container}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.name;

                if (tab.isCenter) {
                    return (
                        <TouchableOpacity
                            key={tab.name}
                            style={styles.centerButton}
                            onPress={() => onTabPress?.(tab.name)}
                        >
                            <View style={[styles.centerButtonInner, isActive && { backgroundColor: '#e9751dff' }]}>
                                {renderIcon(tab, isActive)}
                            </View>
                            <Text style={[styles.centerLabel, isActive && styles.activeLabel]}>{tab.name}</Text>
                        </TouchableOpacity>
                    );
                }

                return (
                    <TouchableOpacity
                        key={tab.name}
                        style={styles.tab}
                        onPress={() => onTabPress?.(tab.name)}
                    >
                        {renderIcon(tab, isActive)}
                        <Text style={[styles.label, isActive && styles.activeLabel]}>
                            {tab.name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderTopWidth: 0,
        paddingBottom: 20,
        paddingTop: 8,
        height: 85,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    label: {
        fontSize: 16,
        color: '#999', // Inactive text color
        marginTop: 0,
    },
    activeLabel: {
        color: '#e9751dff', // Active text color
    },
    centerButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: -35, // Push up more
    },
    centerButtonInner: {
        width: 64, // Larger button
        height: 64,
        borderRadius: 32,
        backgroundColor: '#999', // Deep red
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerLabel: {
        fontSize: 12,
        color: '#999',
        fontWeight: 'bold',
        fontSize: 16,
        marginTop: 2,
    },
});
