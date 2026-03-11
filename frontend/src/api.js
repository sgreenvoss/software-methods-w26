/* 
api.js
Provides functions for HTTP requests
Created on 2026-2-2 by Garrett Caldwell
parseJSONResponse(), apiGetwithMeta(), and apiPostwithMeta() are from updates
*/

async function parseJsonResponse(response) {
  /* 
  Validates response is JSON, parses and returns normalized result objects
  argument is response from a fetch request
  returns a normalized result object
  */
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

export async function apiGet(path) {
  /*
  Sends a GET request to the backend
  Argument is endpoint
  returns parsed json response
  */
  console.log("api getting path:", path);

  // make fetch request
  const response = await fetch(path, {
    credentials: "include"
  });

  // parse response
  const parsed = await parseJsonResponse(response);
  return parsed.data;
}

export async function apiGetWithMeta(path) {
  /* 
  Sends a GET request and returns whole response
  Argument is endpoint
  Returns JSON response with metadeta
  */
  const response = await fetch(path, {
    credentials: "include"
  });

  // returns response with status, ok, etc.
  return parseJsonResponse(response);
}

export async function apiPost(path, data) {
  /* 
  Sends a POST request and parses the response
  Arguments are the backend endpoint and data to be used/changed
  Returns a parsed JSON response
  */

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

export async function apiPostWithMeta(path, data) {
  /* 
  Sends a POST request without parsing response
  Arguments are backend endpoint and data to be used/changed
  Returns a JSON response with metadata
  */

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
