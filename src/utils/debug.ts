// Debug configuration
interface DebugConfig {
  enabled: boolean;
  modules: {
    auth: boolean;
    token: boolean;
    sheets: boolean;
    verses: boolean;
    db: boolean;
  };
}

// Default configuration - all modules enabled
const defaultConfig: DebugConfig = {
  enabled: false, // Start with debug mode off by default
  modules: {
    auth: true,
    token: true,
    sheets: true,
    verses: true,
    db: true
  },
};

// Current configuration
let config: DebugConfig = { ...defaultConfig };

// Debug logger
export const debug = {
  // Configure debug settings
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
      console.log('[DEBUG] Configuration updated:', config);
    }
  },

  // Reset to default configuration
  reset: () => {
    config = { ...defaultConfig };
    if (config.enabled) {
      console.log('[DEBUG] Configuration reset to defaults');
    }
  },

  // Enable debug mode
  enable: () => {
    config.enabled = true;
    console.log('[DEBUG] Debug mode enabled');
  },

  // Disable debug mode
  disable: () => {
    config.enabled = false;
    console.log('[DEBUG] Debug mode disabled');
  },

  // Debug logging functions - only for developers
  log: (module: keyof DebugConfig['modules'], message: string, ...args: any[]) => {
    if (config.enabled && config.modules[module]) {
      console.log(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  },

  error: (module: keyof DebugConfig['modules'], message: string, ...args: any[]) => {
    if (config.enabled && config.modules[module]) {
      console.error(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  },

  warn: (module: keyof DebugConfig['modules'], message: string, ...args: any[]) => {
    if (config.enabled && config.modules[module]) {
      console.warn(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  },

  // Get current configuration
  getConfig: () => ({ ...config }),
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
      description: `Your email (${email}) is not authorized to use this application.`,
      action: 'Contact Support',
      contactEmail: 'ben@benandjacq.com',
    }),
    tokenExpired: () => ({
      title: 'Session Expired',
      description: 'Your session has expired. Please sign in again.',
      action: 'Sign In',
    }),
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

  // Sheet access errors
  sheets: {
    noAccess: () => ({
      title: 'Access Denied',
      description: 'You do not have permission to access this content.',
      action: 'Contact Support',
      contactEmail: 'ben@benandjacq.com',
    }),
    connectionFailed: () => ({
      title: 'Connection Error',
      description: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Retry',
    }),
  },
};

// Expose debug configuration to window for browser console access
declare global {
  interface Window {
    debug: typeof debug;
  }
}

window.debug = debug; 