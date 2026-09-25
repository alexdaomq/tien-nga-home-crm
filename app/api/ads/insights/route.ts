import { getDb, getOrCreateSettings } from "../../../../db";

const ALLOWED_PRESETS = new Set(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month", "last_month"]);
const GRAPH_VERSION = "v21.0";

// Các loại "kết quả" tin nhắn / lead thường gặp trên quảng cáo Messenger của Tiến Nga.
const RESULT_ACTION_TYPES = new Set([
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const preset = url.searchParams.get("preset") ?? "last_30d";
    if (!ALLOWED_PRESETS.has(preset)) {
      return Response.json({ error: "Khoảng thời gian chưa hợp lệ." }, { status: 400 });
    }

    const db = getDb();
    const settings = await getOrCreateSettings(db);
    const accountId = (settings.fbAdAccountId ?? "").trim();
    const token = (settings.fbAccessToken ?? "").trim();
    if (!accountId || !token) {
      return Response.json({ error: "Chưa kết nối Facebook. Hãy dán tài khoản quảng cáo và access token trước.", notConnected: true }, { status: 400 });
    }

    const fields = "spend,impressions,reach,clicks,cpc,ctr,cpm,frequency,actions";
    const graphUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights?fields=${fields}&date_preset=${preset}`;
    const res = await fetch(graphUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as {
      error?: { message?: string; code?: number };
      data?: Array<Record<string, unknown>>;
    };

    if (data.error) {
      const msg = data.error.message || "Facebook trả về lỗi.";
      const expired = data.error.code === 190;
      return Response.json({ error: `Facebook: ${msg}`, tokenExpired: expired }, { status: 400 });
    }

    const row = data.data?.[0];
    if (!row) {
      return Response.json({ metrics: null, empty: true });
    }

    const actions = Array.isArray(row.actions) ? (row.actions as Array<{ action_type?: string; value?: unknown }>) : [];
    const results = actions
      .filter((a) => a.action_type && RESULT_ACTION_TYPES.has(a.action_type))
      .reduce((sum, a) => sum + num(a.value), 0);
    const spend = num(row.spend);

    return Response.json({
      preset,
      accountId,
      metrics: {
        spend,
        impressions: num(row.impressions),
        reach: num(row.reach),
        clicks: num(row.clicks),
        cpc: num(row.cpc),
        ctr: num(row.ctr),
        cpm: num(row.cpm),
        frequency: num(row.frequency),
        results,
        costPerResult: results > 0 ? Math.round(spend / results) : 0,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}
