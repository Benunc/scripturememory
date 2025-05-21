// Debug configuration
interface DebugConfig {
  enabled: boolean;
  modules: {
    auth: boolean;
    token: boolean;
    sheets: boolean;
    verses: boolean;
  };
}

// Default configuration - enable all modules by default
const defaultConfig: DebugConfig = {
  enabled: true,
  modules: {
    auth: true,
    token: true,
    sheets: true,
    verses: true,
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
    console.log('[DEBUG] Configuration updated:', config);
  },

  // Reset to default configuration
  reset: () => {
    config = { ...defaultConfig };
    console.log('[DEBUG] Configuration reset to defaults');
  },

  // Log function
  log: (module: keyof DebugConfig['modules'], message: string, ...args: any[]) => {
    if (config.enabled && config.modules[module]) {
      console.log(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  },

  // Error function
  error: (module: keyof DebugConfig['modules'], message: string, ...args: any[]) => {
    if (config.enabled && config.modules[module]) {
      console.error(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  },

  // Get current configuration
  getConfig: () => ({ ...config }),
};

// Expose debug configuration to window for browser console access
declare global {
  interface Window {
    debug: typeof debug;
  }
}

window.debug = debug; 