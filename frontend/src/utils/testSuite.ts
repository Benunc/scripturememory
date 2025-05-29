import { API_URL } from '../config';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
}

class TestSuite {
  private results: TestResult[] = [];
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    // Use the current origin for the API URL
    this.baseUrl = window.location.origin;
  }

  private async test(name: string, testFn: () => Promise<any>): Promise<void> {
    try {
      const response = await testFn();
      this.results.push({ name, passed: true, response });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.results.push({ 
        name, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.error(`❌ ${name}:`, error);
    }
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  private getAuthHeader(): HeadersInit {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting test suite...\n');

    // Check if we're authenticated
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      console.error('❌ Authentication required. Please sign in first.');
      return;
    }
    this.token = authToken;

    // Test 1: Health Check
    await this.test('Health Check', async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/health`);
      if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
      const data = await response.json();
      if (data.status !== 'ok') throw new Error('Invalid health check response');
      return data;
    });

    // Test 2: Get Verses
    await this.test('Get Verses', async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/verses`);
      if (!response.ok) throw new Error(`Get verses failed: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid verses response format');
      return data;
    });

    // Test 3: Get Single Verse
    await this.test('Get Single Verse', async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/verses/1`);
      if (!response.ok) throw new Error(`Get single verse failed: ${response.status}`);
      const data = await response.json();
      if (!data.id || !data.text) throw new Error('Invalid verse response format');
      return data;
    });

    // Test 4: Get Progress
    await this.test('Get Progress', async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/progress`, {
        headers: this.getAuthHeader()
      });
      if (!response.ok) throw new Error(`Get progress failed: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid progress response format');
      return data;
    });

    // Test 5: Update Progress
    await this.test('Update Progress', async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify({
          verseId: 1,
          status: 'memorized'
        })
      });
      if (!response.ok) throw new Error(`Update progress failed: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error('Invalid update progress response');
      return data;
    });

    // Print Summary
    console.log('\n📊 Test Summary:');
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    console.log(`Passed: ${passed}/${total} tests`);
    
    if (passed < total) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`- ${r.name}: ${r.error}`));
    }
  }
}

// Export a function to run the test suite
export const runTestSuite = async () => {
  const suite = new TestSuite();
  await suite.runAllTests();
};

// Add to window for console access
declare global {
  interface Window {
    runTestSuite: typeof runTestSuite;
  }
}

if (typeof window !== 'undefined') {
  window.runTestSuite = runTestSuite;
} 