// Test utility to verify admin API connectivity
export async function testAdminApi() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai');
  const testUrl = `${baseUrl}/api/admin/prompts`;
  
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
