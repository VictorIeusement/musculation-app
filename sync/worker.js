/* Dépôt central des séances, et passerelle Withings.

   Racine — la sauvegarde chiffrée :
     GET  /   → renvoie la dernière enveloppe connue (ou null)
     PUT  /   → la remplace, après validation JSON
   L'authentification est un jeton partagé, envoyé en en-tête Authorization.
   Le Worker ne voit passer que du chiffré : il ne l'inspecte pas.

   /withings/* — la liaison avec la balance :
     POST /withings/start     → prépare une autorisation, renvoie l'URL à ouvrir
     GET  /withings/callback  → Withings y renvoie l'utilisateur, échange le code
     GET  /withings/measures  → renvoie les mesures, normalisées comme l'import
     POST /withings/forget    → oublie la liaison
   Le secret Withings vit ici, en secret Wrangler : il ne peut pas vivre dans
   l'app, qui est un fichier statique dans un dépôt public.

   Les routes authentifiées exigent le jeton partagé. `callback` ne peut pas :
   c'est Withings qui y renvoie le navigateur, sans en-tête. Elle est protégée
   par un `state` à usage unique, tiré au sort par le Worker, gardé dix minutes
   et brûlé à l'usage. */

const KEY = "seances";
const LIAISON = "withings";          // jetons Withings, dans le même KV
const MAX = 1_000_000;               // 1 Mo, très au-dessus d'un historique

/* Endpoints Withings. Ils n'ont pas pu être vérifiés depuis l'atelier où ce
   code a été écrit : leur domaine y est injoignable. Si le premier essai
   échoue, c'est ici qu'il faut regarder en premier. */
const W_AUTH = "https://account.withings.com/oauth2_user/authorize2";
const W_API  = "https://wbsapi.withings.net/v2/oauth2";
const W_MES  = "https://wbsapi.withings.net/measure";
const W_SCOPE = "user.metrics";

/* Types de mesure Withings → nos clés. La valeur réelle est value × 10^unit. */
const TYPES = {1:"kg", 6:"fatpc", 8:"fat", 76:"muscle", 77:"water", 88:"bone"};

export default {
  async fetch(request, env) {
    const cors = {
      "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
      "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-max-age": "86400"
    };
    const reply = (body, status) =>
      new Response(body, {status, headers: {...cors, "content-type": "application/json"}});
    const erreur = (msg, status) => reply(JSON.stringify({error: msg}), status);

    if (request.method === "OPTIONS") return new Response(null, {headers: cors});

    const url = new URL(request.url);
    const chemin = url.pathname.replace(/\/+$/, "") || "/";
    const autorise = () => {
      const sent = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
      return env.SYNC_KEY && constantEquals(sent, env.SYNC_KEY);
    };

    /* ---- le retour de Withings : pas d'en-tête possible, d'où le state ---- */
    if (chemin === "/withings/callback") {
      const code = url.searchParams.get("code"), state = url.searchParams.get("state");
      if (!code || !state) return page("Autorisation incomplète", "Withings n'a pas renvoyé de code. Recommence depuis l'app.");
      const attendu = await env.DB.get("state:" + state);
      if (!attendu) return page("Demande inconnue", "Cette autorisation a expiré ou n'a pas été demandée depuis l'app. Recommence.");
      await env.DB.delete("state:" + state);
      try {
        const jetons = await echanger(env, {
          grant_type: "authorization_code",
          code,
          redirect_uri: url.origin + "/withings/callback"
        });
        await env.DB.put(LIAISON, JSON.stringify(jetons));
        return page("Withings est connecté", "Tu peux fermer cette page et revenir dans l'app.");
      } catch (e) {
        return page("Withings a refusé l'échange", String(e.message || e));
      }
    }

    if (!autorise()) return erreur("cle refusee", 401);

    /* ---- préparer une autorisation ---- */
    if (chemin === "/withings/start" && request.method === "POST") {
      if (!env.WITHINGS_ID) return erreur("WITHINGS_ID manquant dans les secrets du Worker", 500);
      const state = crypto.randomUUID();
      await env.DB.put("state:" + state, "1", {expirationTtl: 600});
      const p = new URLSearchParams({
        response_type: "code",
        client_id: env.WITHINGS_ID,
        scope: W_SCOPE,
        redirect_uri: url.origin + "/withings/callback",
        state
      });
      return reply(JSON.stringify({authorize: W_AUTH + "?" + p}), 200);
    }

    if (chemin === "/withings/forget" && request.method === "POST") {
      await env.DB.delete(LIAISON);
      return reply('{"ok":true}', 200);
    }

    /* ---- les mesures, normalisées comme celles de l'import de fichier ---- */
    if (chemin === "/withings/measures") {
      const brut = await env.DB.get(LIAISON);
      if (!brut) return reply('{"lie":false}', 200);
      let jetons = JSON.parse(brut);
      try {
        if (Date.now() > (jetons.expire || 0) - 60_000) {
          jetons = await echanger(env, {grant_type: "refresh_token", refresh_token: jetons.refresh});
          await env.DB.put(LIAISON, JSON.stringify(jetons));
        }
        const depuis = url.searchParams.get("depuis");
        const p = new URLSearchParams({action: "getmeas", meastypes: Object.keys(TYPES).join(","), category: "1"});
        if (depuis) p.set("lastupdate", String(Math.floor(+depuis / 1000)));
        const r = await fetch(W_MES, {
          method: "POST",
          headers: {authorization: "Bearer " + jetons.access, "content-type": "application/x-www-form-urlencoded"},
          body: p
        });
        const j = await r.json();
        if (j.status !== 0) return erreur("withings a repondu status " + j.status + " " + (j.error || ""), 502);
        return reply(JSON.stringify({lie: true, mesures: normaliser(j.body)}), 200);
      } catch (e) {
        return erreur(String(e.message || e), 502);
      }
    }

    /* ---- la sauvegarde chiffrée, inchangée ---- */
    if (chemin === "/") {
      if (request.method === "GET") {
        const v = await env.DB.get(KEY);
        return reply(v || "null", 200);
      }
      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > MAX) return erreur("trop volumineux", 413);
        try { JSON.parse(body); } catch { return erreur("json invalide", 400); }
        await env.DB.put(KEY, body);
        return reply('{"ok":true}', 200);
      }
    }
    return erreur("methode non geree", 405);
  }
};

/* Échange ou rafraîchit les jetons. Withings enveloppe tout dans
   {status, body} : un status non nul est une erreur, même en HTTP 200. */
async function echanger(env, champs) {
  const p = new URLSearchParams({
    action: "requesttoken",
    client_id: env.WITHINGS_ID,
    client_secret: env.WITHINGS_SECRET,
    ...champs
  });
  const r = await fetch(W_API, {
    method: "POST",
    headers: {"content-type": "application/x-www-form-urlencoded"},
    body: p
  });
  const j = await r.json();
  if (j.status !== 0 || !j.body) throw new Error("status " + j.status + " " + (j.error || ""));
  return {
    access: j.body.access_token,
    refresh: j.body.refresh_token,
    expire: Date.now() + (j.body.expires_in || 3600) * 1000,
    userid: j.body.userid
  };
}

/* Un groupe de mesures Withings devient une mesure de l'app : une date, et les
   clés qu'on sait lire. Le taux de masse grasse est recalculé s'il manque, comme
   à l'import de fichier. */
function normaliser(body) {
  const out = [];
  (body && body.measuregrps || []).forEach(g => {
    const m = {d: (g.date || 0) * 1000};
    (g.measures || []).forEach(x => {
      const cle = TYPES[x.type];
      if (cle) m[cle] = Math.round(x.value * Math.pow(10, x.unit) * 100) / 100;
    });
    if (m.fatpc == null && m.fat != null && m.kg) m.fatpc = Math.round(m.fat / m.kg * 1000) / 10;
    if (m.kg != null || m.fat != null || m.muscle != null) out.push(m);
  });
  return out;
}

/* Page rendue dans le navigateur au retour de Withings, dans les couleurs de
   l'app : l'utilisateur y atterrit, il ne doit pas voir du JSON. */
function page(titre, detail) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titre)}</title>
<style>html,body{margin:0;height:100%;background:#0E1013;color:#EDEFF2;
font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:grid;place-items:center}
div{max-width:30ch;padding:24px;text-align:center}h1{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0 0 10px}
p{color:#9BA3AE;margin:0}</style></head><body>
<div><h1>${esc(titre)}</h1><p>${esc(detail)}</p></div></body></html>`,
    {status: 200, headers: {"content-type": "text/html; charset=utf-8"}});
}

/* comparaison à durée constante : évite de laisser deviner la clé caractère par caractère */
function constantEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
