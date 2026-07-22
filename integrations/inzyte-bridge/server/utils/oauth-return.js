/** Return an agency OAuth popup to the CRM without opening the Inzyte UI. */

function allowedOrigins() {
  return String(
    process.env.CRM_RETURN_ORIGINS ||
      "https://crm.marketingbende.nl,http://localhost:5173,http://127.0.0.1:5173",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function safeOrigin(value) {
  try {
    const origin = new URL(String(value || "")).origin;
    return allowedOrigins().includes(origin) ? origin : null;
  } catch {
    return null;
  }
}

function sendAgencyOAuthResult(
  res,
  stateData,
  provider,
  status,
  errorCode = null,
) {
  const returnOrigin = safeOrigin(stateData?.returnOrigin);
  if (!returnOrigin) return false;

  const payload = JSON.stringify({
    type: "inzyte-oauth-complete",
    provider,
    status,
    error: errorCode,
  }).replace(/</g, "\\u003c");
  const origin = JSON.stringify(returnOrigin).replace(/</g, "\\u003c");

  res
    .status(status === "success" ? 200 : 400)
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "no-store")
    .set(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
    )
    .send(
      `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google-koppeling</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font:16px system-ui}.card{max-width:32rem;padding:2rem;border:1px solid #27272a;border-radius:1rem;background:#18181b;text-align:center}</style></head><body><main class="card"><h1>${status === "success" ? "Koppeling voltooid" : "Koppeling mislukt"}</h1><p>Dit venster sluit automatisch. Je kunt verder in het CRM.</p></main><script>if(window.opener){window.opener.postMessage(${payload},${origin});}window.close();</script></body></html>`,
    );
  return true;
}

module.exports = { sendAgencyOAuthResult };
