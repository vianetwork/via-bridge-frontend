/**
 * Utility functions for getting user IP address
 */

/**
 * Get the user's public IP address using a third-party service
 * @returns Promise<string> - The user's IP address
 */
export async function getUserIPAddress(): Promise<string> {
  try {
    // Try multiple IP services for reliability
    const ipServices = [
      'https://api.ipify.org?format=json',
      'https://ipapi.co/json/',
      'https://api.myip.com',
      'https://ipinfo.io/json'
    ];

    for (const service of ipServices) {
      try {
        const response = await fetch(service, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        
        // Different services return IP in different fields
        const ip = data.ip || data.query || data.ipAddress;
        
        if (ip && typeof ip === 'string') {
          return ip;
        }
      } catch (error) {
        // Continue to next service if this one fails
        console.warn(`IP service ${service} failed:`, error);
        continue;
      }
    }

    throw new Error('Unable to determine IP address from any service');
  } catch (error) {
    console.error('Error getting IP address:', error);
    throw new Error('Failed to get user IP address');
  }
}
