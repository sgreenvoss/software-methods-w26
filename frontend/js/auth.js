import { apiGet } from '../src/api.js'

export async function getCurrentUser() {
    return apiGet("/api/me");
}