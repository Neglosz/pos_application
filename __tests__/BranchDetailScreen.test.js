/**
 * This screen used to read store_credentials straight from Supabase and reverse the
 * bundled XOR to show the manager password. It must now ask the backend, which holds
 * the key, and cope with rows written under the old scheme.
 */

jest.mock('../src/services/api', () => ({
    apiRequest: jest.fn(),
    getStoreSettings: jest.fn(),
    updateStoreSettings: jest.fn()
}));
jest.mock('../src/services/supabase', () => ({
    supabase: { auth: { getSession: jest.fn() }, from: jest.fn() }
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({
    requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    MediaTypeOptions: { Images: 'Images' }
}));

const React = require('react');
const { render, waitFor } = require('@testing-library/react-native');

const { apiRequest, getStoreSettings } = require('../src/services/api');
const { supabase } = require('../src/services/supabase');
const BranchDetailScreen = require('../src/screens/BranchDetailScreen').default;

const BRANCH = { id: 'store-1', name: 'สาขาลาดพร้าว', owner_id: 'owner-1', address: 'กทม.', phone: '021234567' };

function renderScreen(branch = BRANCH) {
    return render(React.createElement(BranchDetailScreen, {
        branch, onBack: jest.fn(), onEnterPOS: jest.fn()
    }));
}

describe('BranchDetailScreen — manager credentials', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});

        supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner-1' } } }, error: null });
        supabase.from.mockImplementation(() => ({
            select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(async () => ({ data: { owner_id: 'owner-1' } })) })) }))
        }));

        getStoreSettings.mockResolvedValue({ success: true, data: { promptpay_id: '', promptpay_type: 'phone', promptpay_name: '' } });

        apiRequest.mockImplementation(async (endpoint) => {
            if (endpoint.endsWith('/credentials')) {
                return { success: true, data: { email: 'manager@zippy.pos', password: 'secret123' } };
            }
            return { success: true };
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it('asks the backend for the credentials of this branch', async () => {
        renderScreen();

        await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
            '/branches/store-1/credentials',
            expect.objectContaining({ headers: expect.objectContaining({ 'x-store-id': 'store-1' }) })
        ));
    });

    it('never reads store_credentials directly any more', async () => {
        renderScreen();

        await waitFor(() => expect(apiRequest).toHaveBeenCalled());
        const tablesTouched = supabase.from.mock.calls.map(([t]) => t);
        expect(tablesTouched).not.toContain('store_credentials');
    });

    it('shows the email the backend returned', async () => {
        const ui = renderScreen();

        await waitFor(() => expect(ui.getByText('manager@zippy.pos')).toBeTruthy());
    });

    it('keeps the password masked until it is revealed', async () => {
        const ui = renderScreen();

        await waitFor(() => expect(apiRequest).toHaveBeenCalled());
        expect(ui.getByText('••••••••••')).toBeTruthy();
        expect(ui.queryByText('secret123')).toBeNull();
    });

    it('falls back to a placeholder for a legacy row the server cannot decrypt', async () => {
        apiRequest.mockImplementation(async (endpoint) => (endpoint.endsWith('/credentials')
            ? { success: true, data: { email: 'manager@zippy.pos', password: null } }
            : { success: true }));

        const ui = renderScreen();

        await waitFor(() => expect(ui.getByText('manager@zippy.pos')).toBeTruthy());
        // The screen must not crash or print "null" where the password goes.
        expect(ui.queryByText('null')).toBeNull();
    });

    it('survives a store with no stored credentials at all', async () => {
        apiRequest.mockImplementation(async (endpoint) => (endpoint.endsWith('/credentials')
            ? { error: 'No credentials stored for this store' }
            : { success: true }));

        const ui = renderScreen();

        await waitFor(() => expect(apiRequest).toHaveBeenCalled());
        expect(ui.queryByText('manager@zippy.pos')).toBeNull();
    });

    it('does not fetch anything when there is no branch id', async () => {
        renderScreen({ ...BRANCH, id: undefined });

        await waitFor(() => expect(supabase.auth.getSession).toHaveBeenCalled());
        const credentialCalls = apiRequest.mock.calls.filter(([e]) => String(e).endsWith('/credentials'));
        expect(credentialCalls).toHaveLength(0);
    });
});
