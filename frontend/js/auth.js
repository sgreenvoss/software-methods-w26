import { apiGet } from './api/api.js'

export async function getCurrentUser() {
    return apiGet("/api/me");
}