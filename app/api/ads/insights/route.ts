import { getDb, getOrCreateSettings } from "../../../../db";

const ALLOWED_PRESETS = new Set(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month", "last_month"]);
const GRAPH_VERSION = "v21.0";

const RESULT_ACTION_TYPES = new Set([
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);
const MESSAGING_TYPE = "onsite_conversion.messaging_conversation_started_7d";

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type ActionRow = { action_type?: string; value?: unknown };

function sumResults(actions: ActionRow[]): number {
  return actions.filter((a) => a.action_type && RESULT_ACTION_TYPES.has(a.action_type)).reduce((s, a) => s + num(a.value), 0);
}
function sumType(actions: ActionRow[], type: string): number {
  return actions.filter((a) => a.action_type === type).reduce((s, a) => s + num(a.value), 0);
}
function actionsOf(row: Record<string, unknown>): ActionRow[] {
  return Array.isArray(row.actions) ? (row.actions as ActionRow[]) : [];
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

    const auth = { Authorization: `Bearer ${token}` };
    const base = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights`;
    const summaryFields = "spend,impressions,reach,clicks,cpc,ctr,cpm,frequency,inline_link_clicks,cost_per_inline_link_click,actions";
    const campaignFields = "campaign_name,spend,reach,impressions,clicks,ctr,actions";

    const [summaryRes, campaignRes] = await Promise.all([
      fetch(`${base}?fields=${summaryFields}&date_preset=${preset}`, { headers: auth }),
      fetch(`${base}?fields=${campaignFields}&level=campaign&date_preset=${preset}&limit=50`, { headers: auth }),
    ]);
    const summaryData = (await summaryRes.json()) as { error?: { message?: string; code?: number }; data?: Array<Record<string, unknown>> };
    const campaignData = (await campaignRes.json()) as { error?: { message?: string }; data?: Array<Record<string, unknown>> };

    if (summaryData.error) {
      const msg = summaryData.error.message || "Facebook trả về lỗi.";
      return Response.json({ error: `Facebook: ${msg}`, tokenExpired: summaryData.error.code === 190 }, { status: 400 });
    }

    const row = summaryData.data?.[0];
    if (!row) {
      return Response.json({ metrics: null, campaigns: [], empty: true });
    }

    const acts = actionsOf(row);
    const results = sumResults(acts);
    const spend = num(row.spend);
    const messaging = sumType(acts, MESSAGING_TYPE);
    const inlineLinkClicks = num(row.inline_link_clicks);

    const campaigns = (campaignData.data ?? [])
      .map((c) => {
        const cActs = actionsOf(c);
        const cSpend = num(c.spend);
        const cResults = sumResults(cActs);
        return {
          name: String(c.campaign_name ?? "Chiến dịch"),
          spend: cSpend,
          reach: num(c.reach),
          impressions: num(c.impressions),
          clicks: num(c.clicks),
          ctr: num(c.ctr),
          results: cResults,
          costPerResult: cResults > 0 ? Math.round(cSpend / cResults) : 0,
        };
      })
      .sort((a, b) => b.spend - a.spend);

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
        messaging,
        inlineLinkClicks,
        costPerLinkClick: num(row.cost_per_inline_link_click),
      },
      campaigns,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}
