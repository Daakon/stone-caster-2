/**
 * Cloudflare Worker for handling 301 redirects from /adventures* to /stories*
 * 
 * This worker runs at the edge and provides authoritative redirects before
 * the client-side fallback redirects can take effect.
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Handle /adventures redirects
  if (url.pathname.startsWith('/adventures')) {
    // Extract the path after /adventures
    const pathAfterAdventures = url.pathname.substring('/adventures'.length)
    
    // Build the new URL with /stories
    const newPath = '/stories' + pathAfterAdventures
    const newUrl = new URL(newPath, url.origin)
    
    // Preserve query parameters
    newUrl.search = url.search
    
    // Return 301 redirect
    return Response.redirect(newUrl.toString(), 301)
  }
  
  // For all other requests, pass through to the origin
  return fetch(request)
}
