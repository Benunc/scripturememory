# Scripture Memory

A modern web application for memorizing Bible verses, built with React, Cloudflare Workers, and D1 database.

## Features

- **Magic Link Authentication**: Secure, passwordless authentication via email
- **Verse Management**: Add, edit, and delete scripture verses
- **Progress Tracking**: Track your memorization progress
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Mode**: Automatic theme switching based on system preferences

## Tech Stack

### Frontend
- React 18
- TypeScript
- Chakra UI for styling
- Vite for building
- React Router for navigation.

### Backend
- Cloudflare Workers
- D1 Database
- Cloudflare Turnstile for bot protection

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
├── workers/           # Cloudflare Workers backend
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
