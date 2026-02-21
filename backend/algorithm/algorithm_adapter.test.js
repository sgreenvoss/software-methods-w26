const pool = require('../../db'); // Your actual Postgres connection
const { fetchAndMapGroupEvents } = require('./algorithm_adapter');

describe('Algorithm Adapter - DB Integration', () => {
    
    // 1. SETUP (Optional): Insert fake users/events into a test DB here if needed
    beforeAll(async () => {
        // e.g., await pool.query('INSERT INTO group_match...');
    });

    // 2. TEARDOWN (Mandatory): Kill the DB connection so Jest can exit safely
    afterAll(async () => {
        // If pool has an .end() method, call it. 
        // If it's a wrapper, try pool.pool.end() or similar.
        if (pool && typeof pool.end === 'function') {
            await pool.end();
        } else if (pool && pool.pool && typeof pool.pool.end === 'function') {
            await pool.pool.end();
        } else {
            console.warn("Could not find a way to close the DB connection. Jest might hang.");
        }
    });

    // 3. THE ACTUAL TEST
    it('should successfully fetch from Postgres and map to the Participant array', async () => {
        const groupId = 1; // Assuming group 1 exists in your DB
        const windowStartMs = Date.now();
        const windowEndMs = windowStartMs + (7 * 24 * 60 * 60 * 1000);

        // Hit the actual database
        const participants = await fetchAndMapGroupEvents(pool, groupId, windowStartMs, windowEndMs);

        // Verify the Adapter did its job
        expect(Array.isArray(participants)).toBe(true);
        
        // If we know group 1 has users, we can test the structure
        if (participants.length > 0) {
            expect(participants[0]).toHaveProperty('userId');
            expect(Array.isArray(participants[0].events)).toBe(true);
        }
    });
});