const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function apiGet(path) {
  const response = await fetch(BACKEND_URL + path, {
    credentials: "include"
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    console.error('Response is not JSON:', response.status, await response.text());
    throw new Error('Server returned non-JSON response');
  }

  return response.json();
}

export async function apiPost(path, data) {
  const response = await fetch(BACKEND_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    console.error('Response is not JSON:', response.status, await response.text());
    throw new Error('Server returned non-JSON response');
  }
  
  return response.json();
}
