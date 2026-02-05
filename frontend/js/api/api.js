// temp fix: added the backend url to the apiget function


export async function apiGet(path) {
  const response = await fetch(path, {
    credentials: "include"
  });
  return response.json();
}

export async function apiPost(path, data) {
  const response = await fetch("https://scheduler-backend-9b2i.onrender.com" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });
  return response.json();
}
