const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.9:5000";

export function getImageUrl(path: string) {
  if (!path) {
    // Return a placeholder image or null
    return null; 
  }
  if (path.startsWith('http')) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}