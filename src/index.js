export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 1. Bearer Token စစ်ဆေးခြင်း
    const authHeader = request.headers.get("Authorization") || "";
    const expectedToken = `Bearer ${env.WEBHOOK_TOKEN}`;
    if (!env.WEBHOOK_TOKEN || authHeader !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    // 2. Message487 Payload မှ စာသားများ ထုတ်ယူခြင်း
    const eventType = payload.type || payload.event || "event";
    const device = payload.device || payload.device_code || "Android";
    const appName = payload.app_name || payload.package_name || "";
    const sender = payload.sender || payload.phone || "";
    const title = payload.title || "";
    const bodyText = payload.text || payload.message || payload.body || JSON.stringify(payload);

    const lines = [
      `<b>[${escapeHtml(String(eventType).toUpperCase())}]</b> — <code>${escapeHtml(String(device))}</code>`,
    ];

    if (appName) lines.push(`<b>App:</b> ${escapeHtml(String(appName))}`);
    if (sender) lines.push(`<b>From:</b> <code>${escapeHtml(String(sender))}</code>`);
    if (title) lines.push(`<b>Title:</b> ${escapeHtml(String(title))}`);
    if (bodyText) lines.push(`\n${escapeHtml(String(bodyText))}`);

    const telegramText = lines.join("\n").slice(0, 4000); // Telegram max 4096 chars

    // 3. Telegram Bot API ဆီ ပို့ခြင်း
    const tgUrl = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TG_CHAT_ID,
        text: telegramText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
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
