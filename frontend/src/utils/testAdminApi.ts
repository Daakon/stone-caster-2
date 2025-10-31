// Test utility to verify admin API connectivity
import { API_BASE } from '../lib/apiBase';

export async function testAdminApi() {
  const testUrl = `${API_BASE}/api/admin/prompts`;
  
  console.log('Testing admin API at:', testUrl);
  
  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body:', text);
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', json);
      return { success: true, data: json };
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      return { success: false, error: 'Invalid JSON response', body: text };
    }
  } catch (error) {
    console.error('API test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
