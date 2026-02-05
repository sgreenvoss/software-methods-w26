import { apiGet } from 'api/api.js'

export async function getCurrentUser() {
    return apiGet("https://scheduler-backend-9b29.onrender.com/api/me");
}