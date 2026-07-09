import { API_BASE_URL } from '../lib/config';

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