/* Dépôt central des séances. Une seule clé KV, un seul utilisateur.
   GET  → renvoie le dernier état connu (ou null)
   PUT  → remplace l'état, après validation JSON
   L'authentification est un jeton partagé, envoyé en en-tête Authorization. */

const KEY = "seances";
const MAX = 1_000_000; // 1 Mo, très au-dessus d'un historique de séances

export default {
  async fetch(request, env) {
    const cors = {
      "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
      "access-control-allow-methods": "GET,PUT,OPTIONS",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-max-age": "86400"
    };
    const reply = (body, status) =>
      new Response(body, {status, headers: {...cors, "content-type": "application/json"}});

    if (request.method === "OPTIONS") return new Response(null, {headers: cors});

    const sent = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
    if (!env.SYNC_KEY || !constantEquals(sent, env.SYNC_KEY))
      return reply('{"error":"cle refusee"}', 401);

    if (request.method === "GET") {
      const v = await env.DB.get(KEY);
      return reply(v || "null", 200);
    }

    if (request.method === "PUT") {
      const body = await request.text();
      if (body.length > MAX) return reply('{"error":"trop volumineux"}', 413);
      try { JSON.parse(body); } catch { return reply('{"error":"json invalide"}', 400); }
      await env.DB.put(KEY, body);
      return reply('{"ok":true}', 200);
    }

    return reply('{"error":"methode non geree"}', 405);
  }
};

/* comparaison à durée constante : évite de laisser deviner la clé caractère par caractère */
function constantEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
