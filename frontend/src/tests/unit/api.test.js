import { apiGet, apiPost } from '../../api.js';

describe('api helpers', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('apiGet returns parsed data when response is JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, value: 123 })
    });

    const data = await apiGet('/api/example');

    expect(global.fetch).toHaveBeenCalledWith('/api/example', {
      credentials: 'include'
    });
    expect(data).toEqual({ success: true, value: 123 });
  });

  test('apiPost returns parsed data when response is JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({ created: true })
    });

    const payload = { a: 1 };
    const data = await apiPost('/api/example', payload);

    expect(global.fetch).toHaveBeenCalledWith('/api/example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    expect(data).toEqual({ created: true });
  });

  test('throws when server returns non-JSON response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'text/html' },
      text: async () => '<html>oops</html>'
    });

    await expect(apiGet('/api/bad')).rejects.toThrow('Server returned non-JSON response');
  });
});
