export async function POST(request: Request) {
  const body = await request.json();

  const { refresh_token } = body as { refresh_token: string };

  if (!refresh_token) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const response = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!,
          grant_type: "refresh_token",
          refresh_token,
        }),
      }
    );

    const data = await response.json();

    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error("Spotify token refresh failed:", error);

    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
