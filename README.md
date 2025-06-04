# Scripture Memory

A modern web application for memorizing Bible verses, built with React, Cloudflare Workers, and D1 database. The app helps users memorize scripture through a gamified experience with progress tracking and mastery system.

## Features

- **Magic Link Authentication**: Secure, passwordless authentication via email
- **Verse Management**: Add, edit, and delete scripture verses
- **Progress Tracking**: 
  - Word-by-word progress tracking
  - Verse attempt recording
  - Mastery mode for when you are ready to try the whole verse for a 500 point reward.
  - Detailed progress visualization at the /points page.
- **Gamification**:
  - Points system for achievements
  - Streak tracking — log in every day for a 50 point bonus
  - Word guessing has a multiplier: keep guessing words correctly, and each correct guess in a row gives you more points!
  - Mastery mode: think you have the whole verse memorized? try for 500 points to prove it: get it right three days in a row (with five overall attempts) and you'll be all set!
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Mode**: Automatic theme switching based on system preferences
- **Offline Support**: Progress tracking works offline with automatic sync (kinda. your milage may vary with offline mode)

## Tech Stack

### Frontend
- React 18
- TypeScript
- Chakra UI for styling
- Vite for building
- React Router for navigation
- IndexedDB for offline storage

### Backend
- Cloudflare Workers
- D1 Database
- Cloudflare Turnstile for bot protection
- RESTful API architecture

## Development

### Prerequisites 
- Node.js >= 20.0.0 
- npm
- Cloudflare account with Workers and D1 enabled

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Benunc/scripturememory.git
   cd scripturememory
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Create `.env` files in both `frontend` and `workers` directories
   - See `.env.example` files for required variables

4. Start development servers:
   ```bash
   # Start frontend
   npm run dev:frontend

   # Start worker
   npm run dev:workers
   ```

### Building

```bash
# Build frontend
npm run build

# Deploy worker
cd workers && npx wrangler deploy
```

## Project Structure

```
scripturememory/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utility functions
│   │   └── types/         # TypeScript type definitions
├── workers/           # Cloudflare Workers backend
│   ├── src/
│   │   ├── auth/         # Authentication logic
│   │   ├── verses/       # Verse management
│   │   ├── progress/     # Progress tracking
│   │   └── gamification/ # Points and achievements
├── shared/           # Shared types and utilities
└── scripts/          # Build and development scripts
```

## Deployment

The application is deployed on Cloudflare:
- Frontend: Cloudflare Pages
- Backend: Cloudflare Workers
- Database: Cloudflare D1

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
