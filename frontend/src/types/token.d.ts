declare module '../utils/token' {
  /**
   * Gets the stored token from local storage
   * @returns The stored token or null if not found
   */
  export function getStoredToken(): string | null;

  /**
   * Stores a token in local storage with an expiry time
   * @param token The token to store
   * @param expiryTime The expiry time in milliseconds since epoch
   */
  export function storeToken(token: string, expiryTime: number): void;

  /**
   * Clears the stored token from local storage
   */
  export function clearStoredToken(): void;

  /**
   * Checks if the stored token is valid
   * @returns True if the token exists and hasn't expired
   */
  export function isTokenValid(): boolean;

  /**
   * Starts periodic token validation
   */
  export function startTokenValidation(): void;

  /**
   * Stops periodic token validation
   */
  export function stopTokenValidation(): void;
} 