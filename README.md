# Scripture Memory

A web application for memorizing Bible verses, built with React, TypeScript, and Vite. The app is deployed on GitHub Pages at [word.benandjacq.com](https://word.benandjacq.com).

## Architecture

### Frontend
- Built with React 18 and TypeScript
- Uses Chakra UI for styling and components
- Vite for build tooling and development server
- Deployed via GitHub Pages with a custom domain

### Backend
- Google Sheets API for data storage
- IndexedDB for local caching and offline support
- Implements a sync service for offline changes

## Development

### Prerequisites
- Node.js 20 or later
- npm
- Google Cloud Project with Sheets API enabled
- Service account credentials

### Environment Variables
Required environment variables:
- `VITE_GOOGLE_SHEET_ID`: ID of the Google Sheet used for data storage
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth client ID
- `VITE_AUTHORIZED_USERS`: Comma-separated list of authorized user emails

### Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with required variables
4. Run development server: `npm run dev`

### Debug Mode
The application includes a comprehensive debug logging system that can be enabled in the browser console:

```javascript
// Enable debug mode
window.debug.enable();

// Configure specific modules
window.debug.configure({
  enabled: true,
  modules: {
    auth: true,
    token: true,
    sheets: true,
    verses: true,
    db: true
  }
});

// View current configuration
window.debug.getConfig();

// Disable debug mode
window.debug.disable();
```

Debug logs are prefixed with module names (e.g., `[AUTH]`, `[SHEETS]`) for easy filtering.

### Build and Deploy
1. Build the app: `npm run build`
2. The GitHub Actions workflow will automatically deploy to GitHub Pages
3. Custom domain configuration is handled in the GitHub repository settings

## Project Structure
- `/src`: Source code
  - `/components`: React components
  - `/utils`: Utility functions and services
  - `/hooks`: Custom React hooks
- `/public`: Static assets
- `/.github/workflows`: GitHub Actions workflows

## Features
- Verse memorization with progressive word reveal
- Offline support with local caching
- Automatic sync when online
- User authentication via Google
- Progress tracking
- Dark mode support
- Mobile-responsive design

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Contact
For support or questions, contact ben@benandjacq.com
