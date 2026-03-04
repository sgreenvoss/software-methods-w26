async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    console.error('Response is not JSON:', response.status, await response.text());
    throw new Error('Server returned non-JSON response');
  }

  const data = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

export async function apiGet(path) {
  console.log("api getting path:", path);
  const response = await fetch(path, {
    credentials: "include"
  });
  const parsed = await parseJsonResponse(response);
  return parsed.data;
}

export async function apiPost(path, data) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });

  const parsed = await parseJsonResponse(response);
  return parsed.data;
}

export async function apiPostWithMeta(path, data) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });

  return parseJsonResponse(response);
}
