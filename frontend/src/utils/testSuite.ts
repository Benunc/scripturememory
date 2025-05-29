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
  private testVerseReference: string | null = null;

  constructor() {
    this.baseUrl = 'https://scripture-memory.ben-2e6.workers.dev';
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
    const authToken = localStorage.getItem('session_token');
    if (!authToken) {
      console.error('❌ Authentication required. Please sign in first.');
      return;
    }
    this.token = authToken;

    // Test 1: Create Test Verse
    await this.test('Create Test Verse', async () => {
      const testReference = 'Testing 1:2';
      this.testVerseReference = testReference;
      const response = await this.fetchWithTimeout(`${this.baseUrl}/verses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify({
          reference: testReference,
          text: 'Blessed are the linters, for they shall inherit the DOM'
        })
      });
      if (!response.ok) throw new Error(`Create verse failed: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error('Invalid create verse response');
      return data;
    });

    // Test 2: Update Test Verse Status
    await this.test('Update Test Verse Status', async () => {
      if (!this.testVerseReference) throw new Error('No test verse reference available');
      const response = await this.fetchWithTimeout(`${this.baseUrl}/verses/${encodeURIComponent(this.testVerseReference)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify({
          status: 'in_progress'
        })
      });
      if (!response.ok) throw new Error(`Update verse failed: ${response.status}`);
      // 204 No Content is a valid response
      return { success: true };
    });

    // Test 3: Delete Test Verse
    await this.test('Delete Test Verse', async () => {
      if (!this.testVerseReference) throw new Error('No test verse reference available');
      const response = await this.fetchWithTimeout(`${this.baseUrl}/verses/${encodeURIComponent(this.testVerseReference)}`, {
        method: 'DELETE',
        headers: this.getAuthHeader()
      });
      if (!response.ok) throw new Error(`Delete verse failed: ${response.status}`);
      // 204 No Content is a valid response
      return { success: true };
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