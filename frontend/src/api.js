/*
File: api.js
Purpose: Centralizes frontend HTTP helpers for GET/POST requests and normalizes
response metadata (status, ok flag, data payload, and trace id).
Creation Date: 2026-02-02
Initial Author(s): Garrett Caldwell

System Context:
This file is part of the Social Schedule frontend service layer. It provides a
single request utility surface used by UI components to communicate with backend
API endpoints while enforcing consistent response parsing and error handling.

Significant Modifications:
- Added `parseJsonResponse`, `apiGetWithMeta`, and `apiPostWithMeta` to support
  response metadata and trace-id-aware request flows.
*/

/**
 * Parses a fetch Response as JSON and returns a normalized response object.
 *
 * @param {Response} response - Raw response object returned by `fetch`.
 * @returns {Promise<{ok: boolean, status: number, data: any, traceId: string|null}>}
 * Normalized response shape containing HTTP status flags, parsed JSON, and trace id.
 * @throws {Error} Throws when the response content type is not JSON.
 */
async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    console.error('Response is not JSON:', response.status, await response.text());
    throw new Error('Server returned non-JSON response');
  }

  // get json response
  const data = await response.json();
  // return json with status and x-trace-id
  return {
    ok: response.ok,
    status: response.status,
    data,
    traceId: response.headers.get('x-trace-id') || null
  };
}

/**
 * Sends an authenticated GET request and returns only the parsed JSON payload.
 *
 * @param {string} path - Backend endpoint path to request.
 * @returns {Promise<any>} Parsed JSON response body (`parsed.data`).
 */
export async function apiGet(path) {
  console.log("api getting path:", path);

  // make fetch request
  const response = await fetch(path, {
    credentials: "include"
  });

  // parse response
  const parsed = await parseJsonResponse(response);
  return parsed.data;
}

/**
 * Sends an authenticated GET request and returns parsed payload plus metadata.
 *
 * @param {string} path - Backend endpoint path to request.
 * @returns {Promise<{ok: boolean, status: number, data: any, traceId: string|null}>}
 * Normalized response with metadata.
 */
export async function apiGetWithMeta(path) {
  const response = await fetch(path, {
    credentials: "include"
  });

  // returns response with status, ok, etc.
  return parseJsonResponse(response);
}

/**
 * Sends an authenticated POST request with JSON body and returns parsed payload.
 *
 * @param {string} path - Backend endpoint path to request.
 * @param {any} data - Request body serialized as JSON.
 * @returns {Promise<any>} Parsed JSON response body (`parsed.data`).
 */
export async function apiPost(path, data) {
  // Make a POST request and receive a response
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });

  // parse the response sent from backend and send data
  const parsed = await parseJsonResponse(response);
  return parsed.data;
}

/**
 * Sends an authenticated POST request with JSON body and returns payload plus metadata.
 *
 * @param {string} path - Backend endpoint path to request.
 * @param {any} data - Request body serialized as JSON.
 * @returns {Promise<{ok: boolean, status: number, data: any, traceId: string|null}>}
 * Normalized response with metadata.
 */
export async function apiPostWithMeta(path, data) {
  // Make post request and receive response
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });

  // return with status, traceId, etc
  return parseJsonResponse(response);
}
