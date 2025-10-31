import { get } from "./http";

/**
 * Fetch current authenticated user information
 * 
 * @returns User data if authenticated, null otherwise
 * 
 * @example
 * ```typescript
 * const user = await fetchMe();
 * if (user) {
 *   console.log('Logged in as:', user.name);
 * }
 * ```
 */
export const fetchMe = async () => {
  try {
    const response = await get("/api/auth/me");
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.log(error);
    return null;
  }
};
