// Debug configuration
interface DebugConfig {
  enabled: boolean;
  modules: {
    auth: boolean;      // Authentication and session management
    api: boolean;       // API calls and responses
    worker: boolean;    // Worker-specific operations
    verses: boolean;    // Verse management
    db: boolean;        // Database operations
    sync: boolean;      // Data synchronization
    network: boolean;   // Network requests and responses
    state: boolean;     // Application state changes
  };
  level: 'error' | 'warn' | 'info' | 'debug';  // Log level
  maskSensitiveData: boolean;  // Whether to mask sensitive data in logs
}

// Default configuration
const defaultConfig: DebugConfig = {
  enabled: false,
  modules: {
    auth: true,
    api: true,
    worker: true,
    verses: true,
    db: true,
    sync: true,
    network: true,
    state: true
  },
  level: 'info',
  maskSensitiveData: true
};

// Current configuration
let config: DebugConfig = { ...defaultConfig };

// Helper to mask sensitive data
const maskSensitiveData = (data: any): any => {
  if (!config.maskSensitiveData) return data;
  
  const sensitiveFields = ['token', 'email', 'password', 'secret', 'key', 'authorization'];
  if (typeof data !== 'object' || data === null) return data;
  
  const masked = { ...data };
  for (const key in masked) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  return masked;
};

// Debug logger
export const debug = {
  // Configuration methods
  configure: (newConfig: Partial<DebugConfig>) => {
    config = {
      ...config,
      ...newConfig,
      modules: {
        ...config.modules,
        ...(newConfig.modules || {}),
      },
    };
    if (config.enabled) {
      console.log('[DEBUG] Configuration updated:', maskSensitiveData(config));
    }
  },

  reset: () => {
    config = { ...defaultConfig };
    if (config.enabled) {
      console.log('[DEBUG] Configuration reset to defaults');
    }
  },

  enable: () => {
    config.enabled = true;
    console.log('[DEBUG] Debug mode enabled');
  },

  disable: () => {
    config.enabled = false;
    console.log('[DEBUG] Debug mode disabled');
  },

  // Logging methods with levels
  log: (module: keyof DebugConfig['modules'], message: string, ...args: any[]) => {
    if (config.enabled && config.modules[module]) {
      const maskedArgs = args.map(arg => maskSensitiveData(arg));
      console.log(`[${module.toUpperCase()}] ${message}`, ...maskedArgs);
    }
  },

  error: (module: keyof DebugConfig['modules'], message: string, ...args: any[]) => {
    if (config.enabled && config.modules[module]) {
      const maskedArgs = args.map(arg => maskSensitiveData(arg));
      console.error(`[${module.toUpperCase()}] ${message}`, ...maskedArgs);
    }
  },

  warn: (module: keyof DebugConfig['modules'], message: string, ...args: any[]) => {
    if (config.enabled && config.modules[module]) {
      const maskedArgs = args.map(arg => maskSensitiveData(arg));
      console.warn(`[${module.toUpperCase()}] ${message}`, ...maskedArgs);
    }
  },

  // Get current configuration
  getConfig: () => ({ ...config }),

  // Toggle sensitive data masking
  toggleMasking: () => {
    config.maskSensitiveData = !config.maskSensitiveData;
    if (config.enabled) {
      console.log(`[DEBUG] Sensitive data masking ${config.maskSensitiveData ? 'enabled' : 'disabled'}`);
    }
  }
};

// User-facing error handling
export const handleError = {
  // Authentication errors
  auth: {
    notSignedIn: () => ({
      title: 'Not Signed In',
      description: 'Please sign in to continue.',
      action: 'Sign In',
    }),
    unauthorized: (email: string) => ({
      title: 'Access Denied',
      description: 'Your email is not authorized to use this application.',
      action: 'Contact Support',
      contactEmail: 'ben@benandjacq.com',
    }),
    tokenExpired: () => ({
      title: 'Session Expired',
      description: 'Your session has expired. Please sign in again.',
      action: 'Sign In',
    }),
    magicLinkFailed: () => ({
      title: 'Magic Link Failed',
      description: 'Unable to send magic link. Please try again.',
      action: 'Try Again',
    }),
    turnstileFailed: () => ({
      title: 'Verification Failed',
      description: 'Please complete the verification and try again.',
      action: 'Try Again',
    })
  },

  // API errors
  api: {
    networkError: () => ({
      title: 'Network Error',
      description: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Retry',
    }),
    serverError: () => ({
      title: 'Server Error',
      description: 'The server encountered an error. Please try again later.',
      action: 'Retry',
    }),
    rateLimited: () => ({
      title: 'Too Many Requests',
      description: 'Please wait a moment before trying again.',
      action: 'Wait and Retry',
    })
  },

  // Verse management errors
  verses: {
    fetchFailed: () => ({
      title: 'Failed to fetch verses',
      description: 'There was an error loading your verses. Please try refreshing the page.',
      action: 'Refresh the page'
    }),
    addFailed: () => ({
      title: 'Failed to add verse',
      description: 'There was an error adding your verse. Please try again.',
      action: 'Try adding the verse again'
    }),
    updateFailed: () => ({
      title: 'Failed to update verse',
      description: 'There was an error updating your verse. Please try again.',
      action: 'Try updating the verse again'
    }),
    deleteFailed: () => ({
      title: 'Failed to delete verse',
      description: 'There was an error deleting your verse. Please try again.',
      action: 'Try deleting the verse again'
    })
  },

  // Database errors
  db: {
    syncFailed: () => ({
      title: 'Sync Failed',
      description: 'Unable to sync your changes. Please try again.',
      action: 'Retry Sync',
    }),
    offline: () => ({
      title: 'Offline Mode',
      description: 'You are currently offline. Changes will be synced when you reconnect.',
      action: 'Continue',
    })
  }
};

// Expose debug configuration to window for browser console access
declare global {
  interface Window {
    debug: typeof debug;
  }
}

window.debug = debug; 