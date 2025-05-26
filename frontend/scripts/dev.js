const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Function to generate a random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Function to set up the database
async function setupDatabase() {
  return new Promise((resolve, reject) => {
    console.log('Setting up local database...');
    const setup = spawn('npx', ['wrangler', 'd1', 'execute', 'DB_DEV', '--file=./schema.sql', '--local'], {
      cwd: path.join(__dirname, '..', '..', 'workers'),
      stdio: 'inherit'
    });

    setup.on('close', (code) => {
      if (code === 0) {
        console.log('Database setup completed successfully');
        resolve();
      } else {
        reject(new Error(`Database setup failed with code ${code}`));
      }
    });
  });
}

// Function to insert test token
async function insertTestToken() {
  const token = generateToken();
  const email = 'test@example.com';
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
  const createdAt = Date.now();

  return new Promise((resolve, reject) => {
    console.log('Inserting test token...');
    const setup = spawn('npx', ['wrangler', 'd1', 'execute', 'DB_DEV', 
      `--command=INSERT INTO magic_links (token, email, expires_at, created_at) VALUES ('${token}', '${email}', ${expiresAt}, ${createdAt});`, 
      '--local'], {
      cwd: path.join(__dirname, '..', '..', 'workers'),
      stdio: 'inherit'
    });

    setup.on('close', (code) => {
      if (code === 0) {
        console.log('Test token inserted successfully');
        resolve(token);
      } else {
        reject(new Error(`Failed to insert test token with code ${code}`));
      }
    });
  });
}

// Main function to start development environment
async function startDev() {
  try {
    // Set up database first
    await setupDatabase();
    
    // Insert test token and get it back
    const token = await insertTestToken();

    // Start the worker and capture its output
    const worker = spawn('npx', ['wrangler', 'dev', 'src/index.ts', '--local', '--env', 'development'], {
      cwd: path.join(__dirname, '..', '..', 'workers'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let workerUrl = null;

    // Listen for the worker's output
    worker.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Worker: ${output}`);
      
      // Look for the "Ready on" message
      const match = output.match(/Ready on (http:\/\/localhost:\d+)/);
      if (match) {
        workerUrl = match[1];
        console.log(`Found worker URL: ${workerUrl}`);
        
        // Create/update .env.development
        const envPath = path.join(__dirname, '..', '.env.development');
        const envContent = `VITE_WORKER_URL=${workerUrl}\n`;
        fs.writeFileSync(envPath, envContent);
        console.log(`Updated ${envPath} with worker URL`);
        
        // Output the verification link
        const verificationLink = `http://localhost:5173/auth/verify?token=${token}`;
        console.log('\n=== Development Verification Link ===');
        console.log('\x1b[36m%s\x1b[0m', verificationLink); // Cyan color
        console.log('\nClick the link above to test the verification flow');
        console.log('===============================================\n');
        
        // Start the Vite dev server with the worker URL
        const vite = spawn('npm', ['run', 'dev'], {
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit',
          env: {
            ...process.env,
            VITE_WORKER_URL: workerUrl
          }
        });
        
        // Handle Vite process exit
        vite.on('exit', (code) => {
          console.log(`Vite process exited with code ${code}`);
          worker.kill();
          process.exit(code);
        });
      }
    });

    // Handle worker process exit
    worker.on('exit', (code) => {
      console.log(`Worker process exited with code ${code}`);
      process.exit(code);
    });

    // Handle errors
    worker.stderr.on('data', (data) => {
      console.error(`Worker error: ${data}`);
    });
  } catch (error) {
    console.error('Failed to start development environment:', error);
    process.exit(1);
  }
}

// Start the development environment
startDev(); 