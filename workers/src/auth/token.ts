export const generateToken = async (): Promise<string> => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const verifyToken = async (token: string): Promise<boolean> => {
  // In a real implementation, you would verify the token's signature
  // For now, we'll just check if it's a valid hex string
  return /^[0-9a-f]{64}$/.test(token);
}; 