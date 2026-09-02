export async function POST(request: Request) {
  const body = await request.json();

  const { code, code_verifier } = body as {
    code: string;
    code_verifier: string;
  };

  if (!code || !code_verifier) {
    return Response.json(
      { error: "invalid_request" },
      { status: 400 }
    );
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
          grant_type: "authorization_code",
          code,
          redirect_uri:
            process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!,
          code_verifier,
        }),
      }
    );

    const data = await response.json();

    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error("Spotify token exchange failed:", error);

    return Response.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
