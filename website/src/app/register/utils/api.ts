export const parseApiResponse = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  throw new Error(
    `API returned non-JSON response (${res.status}). Check backend server and API URL configuration. Received: ${text.slice(0, 80)}...`,
  );
};