export default {
  async fetch(request, env) {
    const authHeader = request.headers.get("Authorization");

    // These are the secrets you already set in Cloudflare
    const expectedAuth = "Basic " + btoa(`${env.AUTH_USER}:${env.AUTH_PASS}`);

    if (authHeader !== expectedAuth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Pricer Access"',
        },
      });
    }

    // SENIOR DEV FIX: 
    // Even though the user typed /pricer.html, we tell the worker
    // to secretly go grab /hidden-pricer.html from the assets folder.
    const url = new URL(request.url);
    url.pathname = "/hidden-pricer.html";
    
    return env.ASSETS.fetch(new Request(url, request));
  },
};