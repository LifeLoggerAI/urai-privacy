export const runtime = 'nodejs';

export async function GET() {
  const body = {
    name: "URAI Privacy Center",
    url: "https://YOUR_DOMAIN_HERE/privacy-center",
    jurisdiction: ["US", "EU", "UK"],
    commitments: [
      "No dark patterns",
      "No sale of personal data",
      "Rights-first posture",
      "Audit-friendly logging"
    ],
    requests: {
      dataExport: "/data-requests",
      deletion: "/data-requests",
      contact: "/data-requests"
    },
    lastUpdatedISO: new Date().toISOString()
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
