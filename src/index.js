export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const authHeader = request.headers.get("Authorization") || "";
    const expectedToken = `Bearer ${env.WEBHOOK_TOKEN}`;
    if (!env.WEBHOOK_TOKEN || authHeader !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) {
      console.error("Missing TG_BOT_TOKEN or TG_CHAT_ID secret");
      return new Response("Missing Telegram secrets", { status: 500 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const eventType = payload.type || payload.event || "event";
    const device = payload.device || payload.device_code || "Android";
    const appName = payload.app_name || payload.package_name || "";
    const sender = payload.sender || payload.phone || "";
    const title = payload.title || "";
    const rawBody = payload.text || payload.message || payload.body || "";

    const lines = [
      `<b>[${escapeHtml(String(eventType).toUpperCase())}]</b> — <code>${escapeHtml(String(device))}</code>`,
    ];
    if (appName) lines.push(`<b>App:</b> ${escapeHtml(String(appName))}`);
    if (sender) lines.push(`<b>From:</b> <code>${escapeHtml(String(sender))}</code>`);
    if (title) lines.push(`<b>Title:</b> ${escapeHtml(String(title))}`);
    if (rawBody) lines.push(`\n${escapeHtml(String(rawBody))}`);

    const telegramText = lines.join("\n").slice(0, 4000);

    const tgUrl = `https://api.telegram.org/bot${env.TG_BOT_TOKEN.trim()}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(env.TG_CHAT_ID).trim(),
        text: telegramText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      console.error("Telegram API failed:", JSON.stringify(tgData));
      return new Response(JSON.stringify({ ok: false, telegram: tgData }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, forwarded: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
      }
