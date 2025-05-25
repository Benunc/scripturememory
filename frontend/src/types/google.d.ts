export {};

interface Gapi {
  load: (api: string, options: { callback: () => void; onerror: (error: any) => void }) => void;
  client: {
    init: (config: {
      apiKey: string;
      clientId: string;
      discoveryDocs: string[];
      scope: string;
    }) => Promise<void>;
    sheets: {
      spreadsheets: {
        values: {
          get: (params: {
            spreadsheetId: string;
            range: string;
          }) => Promise<{
            result: {
              values: any[][];
            };
          }>;
          update: (params: {
            spreadsheetId: string;
            range: string;
            valueInputOption: string;
            resource: {
              values: any[][];
            };
          }) => Promise<void>;
          append: (params: {
            spreadsheetId: string;
            range: string;
            valueInputOption: string;
            resource: {
              values: any[][];
            };
          }) => Promise<void>;
        };
      };
    };
  };
  auth2: {
    getAuthInstance: () => {
      isSignedIn: {
        get: () => boolean;
      };
      signIn: () => Promise<void>;
    };
  };
}

declare global {
  interface Window {
    gapi: Gapi;
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              expires_in?: number;
            }) => void;
            error_callback?: (error: {
              message?: string;
            }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
} 