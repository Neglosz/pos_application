/**
 * The credential path is the reason this component has tests: it used to encrypt the
 * manager password in the bundle and write it to store_credentials itself. It must
 * now hand the password to the backend and never touch that table.
 */

jest.mock('../src/services/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../src/services/supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, from: jest.fn() } }));
jest.mock('../src/config', () => ({ API_BASE_URL: 'http://localhost:3000/api' }));

const React = require('react');
const { render, fireEvent, waitFor } = require('@testing-library/react-native');
const { Alert } = require('react-native');

const { apiRequest } = require('../src/services/api');
const { supabase } = require('../src/services/supabase');
const AddBranchModal = require('../src/components/AddBranchModal').default;

/** A `from()` chain that resolves to `result` for both the dup-check and the insert. */
function supabaseTable(result) {
    const chain = {};
    for (const method of ['select', 'eq', 'limit', 'insert', 'single']) {
        chain[method] = jest.fn(() => chain);
    }
    chain.limit = jest.fn(async () => result);
    chain.single = jest.fn(async () => result);
    return chain;
}

describe('AddBranchModal — branch creation', () => {
    let alertSpy;
    let storesTable;

    beforeEach(() => {
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        supabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'owner-1' }, access_token: 'token' } }
        });

        storesTable = supabaseTable({ data: { id: 'store-1' }, error: null });
        supabase.from.mockImplementation(() => storesTable);

        apiRequest.mockResolvedValue({ success: true, manager_id: 'manager-1', email: 'store-x@zippy.pos' });
    });

    afterEach(() => jest.restoreAllMocks());

    /** Fill in a branch name and press the submit button. */
    async function submit(ui) {
        fireEvent.changeText(ui.getByPlaceholderText('สาขา'), 'สาขาลาดพร้าว');
        fireEvent.press(ui.getByText('ยืนยัน'));
    }

    it('creates the manager through the backend, passing the generated credentials', async () => {
        const ui = render(React.createElement(AddBranchModal, { visible: true, onClose: jest.fn(), onSuccess: jest.fn() }));

        await submit(ui);

        await waitFor(() => expect(apiRequest).toHaveBeenCalled());
        const [endpoint, options] = apiRequest.mock.calls[0];
        expect(endpoint).toBe('/branches/create-manager');
        expect(options.method).toBe('POST');

        const body = JSON.parse(options.body);
        expect(body.store_id).toBe('store-1');
        expect(body.email).toMatch(/@zippy\.pos$/);
        expect(body.password).toEqual(expect.any(String));
        expect(body.password.length).toBeGreaterThanOrEqual(8);
    });

    it('never writes to store_credentials from the app', async () => {
        const ui = render(React.createElement(AddBranchModal, { visible: true, onClose: jest.fn(), onSuccess: jest.fn() }));

        await submit(ui);

        await waitFor(() => expect(apiRequest).toHaveBeenCalled());
        const tablesTouched = supabase.from.mock.calls.map(([t]) => t);
        expect(tablesTouched).not.toContain('store_credentials');
        expect(tablesTouched).toContain('stores');
    });

    it('never puts the plaintext password anywhere but the backend call', async () => {
        const ui = render(React.createElement(AddBranchModal, { visible: true, onClose: jest.fn(), onSuccess: jest.fn() }));

        await submit(ui);

        await waitFor(() => expect(apiRequest).toHaveBeenCalled());
        const password = JSON.parse(apiRequest.mock.calls[0][1].body).password;

        // The only other writes are the store insert and the duplicate lookups.
        const inserted = storesTable.insert.mock.calls.map(([payload]) => JSON.stringify(payload)).join('');
        expect(inserted).not.toContain(password);
    });

    it('reports the backend error instead of claiming success', async () => {
        apiRequest.mockResolvedValue({ success: false, error: 'email already registered' });
        const onSuccess = jest.fn();
        const ui = render(React.createElement(AddBranchModal, { visible: true, onClose: jest.fn(), onSuccess }));

        await submit(ui);

        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('ข้อผิดพลาด', 'email already registered'));
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('refuses to submit without a branch name', async () => {
        const ui = render(React.createElement(AddBranchModal, { visible: true, onClose: jest.fn(), onSuccess: jest.fn() }));

        fireEvent.press(ui.getByText('ยืนยัน'));

        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('ข้อมูลไม่ครบ', expect.stringContaining('ชื่อสาขา')));
        expect(apiRequest).not.toHaveBeenCalled();
    });

    it('stops when the session has expired rather than creating a half-made branch', async () => {
        supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
        const ui = render(React.createElement(AddBranchModal, { visible: true, onClose: jest.fn(), onSuccess: jest.fn() }));

        await submit(ui);

        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('ข้อผิดพลาด', expect.stringContaining('Session')));
        expect(apiRequest).not.toHaveBeenCalled();
    });
});
