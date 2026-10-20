/** Lets the iPhone app open this site's links (invites, sign-in) instead of Safari. Apple fetches it when the app installs. */
export function GET() {
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: ["JC8ALTGZWS.com.yardensamorai.homie"],
          components: [{ "/": "/api/*", exclude: true }, { "/": "/*" }],
        },
      ],
    },
  });
}
