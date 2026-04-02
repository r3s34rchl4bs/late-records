export default {
  async fetch(request, env) {
    const authHeader = request.headers.get("Authorization");
    const expectedAuth = "Basic " + btoa(`${env.AUTH_USER}:${env.AUTH_PASS}`);

    if (authHeader !== expectedAuth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Pricer Access"' },
      });
    }

    const url = new URL(request.url);
    // This tells the worker to fetch the file you renamed
    url.pathname = "/hidden-pricer.html";

    return env.ASSETS.fetch(new Request(url, request));
  },
};