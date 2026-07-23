import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    const html = `
      <html>
        <body style="background: #020617; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; padding: 2rem; background: #0f172a; border-radius: 12px; border: 1px solid #1e293b;">
            <h2>Authentication Canceled or Failed</h2>
            <p style="color: #94a3b8;">${error}</p>
            <button onclick="window.close()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Close Window</button>
          </div>
        </body>
      </html>
    `;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' }, status: 400 });
  }

  const html = `
    <html>
      <body style="background: #020617; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code: '${code || ''}' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <div style="text-align: center; padding: 2rem; background: #0f172a; border-radius: 12px; border: 1px solid #1e293b;">
          <h2>Authentication Successful</h2>
          <p style="color: #94a3b8;">This window will close automatically...</p>
        </div>
      </body>
    </html>
  `;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
