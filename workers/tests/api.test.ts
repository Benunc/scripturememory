import fetch from 'node-fetch';

const API_URL = 'http://localhost:51027';
const TEST_EMAIL = 'test@example.com';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
  try {
    await testFn();
    return { name, passed: true };
  } catch (error) {
    return { 
      name, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

async function getMagicLink(): Promise<string> {
  const response = await fetch(`${API_URL}/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get magic link: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function verifyMagicLink(token: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/verify?token=${token}`);
  
  if (!response.ok) {
    throw new Error(`Failed to verify magic link: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function runTests() {
  const results: TestResult[] = [];
  let sessionToken: string;

  // Authentication Tests
  results.push(await runTest('Get magic link', async () => {
    const token = await getMagicLink();
    if (!token) throw new Error('No token received');
  }));

  results.push(await runTest('Verify magic link', async () => {
    const magicToken = await getMagicLink();
    sessionToken = await verifyMagicLink(magicToken);
    if (!sessionToken) throw new Error('No session token received');
  }));

  results.push(await runTest('Invalid session token', async () => {
    const response = await fetch(`${API_URL}/verses`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    if (response.status !== 401) throw new Error('Expected 401 Unauthorized');
  }));

  results.push(await runTest('Missing authorization header', async () => {
    const response = await fetch(`${API_URL}/verses`);
    if (response.status !== 401) throw new Error('Expected 401 Unauthorized');
  }));

  // Rate Limiting Test
  results.push(await runTest('Rate limiting', async () => {
    const requests = Array(6).fill(null).map(() => 
      fetch(`${API_URL}/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL })
      })
    );
    
    const responses = await Promise.all(requests);
    const lastResponse = responses[responses.length - 1];
    if (lastResponse.status !== 429) throw new Error('Expected 429 Too Many Requests');
  }));

  // Verse Management Tests
  const testVerse = {
    reference: 'John 3:16',
    text: 'For God so loved the world...',
    translation: 'NIV'
  };

  results.push(await runTest('Create verse', async () => {
    const response = await fetch(`${API_URL}/verses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify(testVerse)
    });
    
    if (!response.ok) throw new Error(`Failed to create verse: ${response.statusText}`);
  }));

  results.push(await runTest('Get verses', async () => {
    const response = await fetch(`${API_URL}/verses`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    
    if (!response.ok) throw new Error(`Failed to get verses: ${response.statusText}`);
    const verses = await response.json();
    if (!Array.isArray(verses)) throw new Error('Expected array of verses');
  }));

  results.push(await runTest('Update verse', async () => {
    const response = await fetch(`${API_URL}/verses/${encodeURIComponent(testVerse.reference)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ text: 'Updated text' })
    });
    
    if (response.status !== 204) throw new Error(`Failed to update verse: ${response.statusText}`);
  }));

  results.push(await runTest('Delete verse', async () => {
    const response = await fetch(`${API_URL}/verses/${encodeURIComponent(testVerse.reference)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    
    if (response.status !== 204) throw new Error(`Failed to delete verse: ${response.statusText}`);
  }));

  // Validation Tests
  results.push(await runTest('Create verse without required fields', async () => {
    const response = await fetch(`${API_URL}/verses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({})
    });
    
    if (response.status !== 400) throw new Error('Expected 400 Bad Request');
  }));

  results.push(await runTest('Update nonexistent verse', async () => {
    const response = await fetch(`${API_URL}/verses/nonexistent`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ text: 'Updated text' })
    });
    
    if (response.status !== 404) throw new Error('Expected 404 Not Found');
  }));

  // CORS Test
  results.push(await runTest('CORS preflight', async () => {
    const response = await fetch(`${API_URL}/verses`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization'
      }
    });
    
    if (!response.headers.get('Access-Control-Allow-Origin')) {
      throw new Error('Missing CORS headers');
    }
  }));

  // Print Results
  console.log('\nTest Results:');
  console.log('============');
  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  const passed = results.filter(r => r.passed).length;
  console.log(`\n${passed}/${results.length} tests passed`);
}

// Run the tests
runTests().catch(console.error); 