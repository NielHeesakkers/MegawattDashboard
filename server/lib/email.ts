// Gedeelde email-layout helpers — dashboard-thema (donker teal)

// SVG logo als base64 data URI zodat het werkt in alle email-clients
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.35 5.67" width="160" height="32"><path fill="#FFFF00" d="M27.47,3.24v-1.82h.87v-.63h-.87v-.79h-.67v2.96-.16s0,.45,0,.45c0,.67.29.96.96.96h.58v-.62h-.53c-.26,0-.34-.08-.34-.34h0ZM26.01,4.2h.58v-.62h-.53c-.26,0-.34-.08-.34-.34v-1.82h0s.87,0,.87,0v-.63h0s-.87,0-.87,0v-.79h-.67v.79h-.55v.63h.55v1.83c0,.67.29.96.96.96h0ZM24.53,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.67.45h.36v-.62h-.23ZM23.69,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM20.26,4.2l1.19-3.57h-.68l-.86,2.68-.82-2.68h-.6l-.87,2.68-.82-2.68h-.7l1.15,3.57h.69l.83-2.45.79,2.45h.69ZM16.23,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.66.45h.36v-.62h-.23ZM15.4,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM12.72,4.05V.63h-.58l-.06.49c-.25-.35-.65-.53-1.15-.53-1.01,0-1.72.75-1.72,1.82s.67,1.82,1.72,1.82c.49,0,.87-.17,1.13-.51v.3c0,.7-.35,1.04-1.06,1.04-.55,0-.92-.23-1-.63v-.04h-.68v.06c.1.76.71,1.22,1.65,1.22,1.17,0,1.77-.55,1.77-1.62h0ZM12.06,2.43c0,.71-.45,1.21-1.08,1.21s-1.09-.49-1.09-1.22.44-1.22,1.09-1.22,1.08.5,1.08,1.23h0ZM8.93,2.58c.01-.12.01-.22.01-.29-.03-1.04-.68-1.69-1.69-1.69s-1.69.75-1.69,1.82.71,1.82,1.77,1.82c.79,0,1.41-.5,1.56-1.24v-.04s-.67,0-.67,0v.02c-.11.42-.46.66-.93.66-.61,0-1.01-.41-1.04-1.06h2.69ZM8.23,2.01h-1.94c.07-.47.48-.82.97-.82.1,0,.2.01.29.03.39.09.65.37.69.79h0ZM4.61,4.2h.67v-2.05c0-.99-.5-1.56-1.36-1.56-.53,0-.94.21-1.19.6-.21-.38-.6-.6-1.1-.6-.4,0-.72.14-.97.44l-.06-.4h-.58v3.57h.67v-1.88c0-.67.34-1.11.86-1.11s.78.34.78.97v2.01h.67v-1.9c0-.68.33-1.08.87-1.08.63,0,.76.53.76.97v2.01h0Z"/></svg>`;

const LOGO_B64 = Buffer.from(LOGO_SVG).toString('base64');
const LOGO_IMG = `<img src="data:image/svg+xml;base64,${LOGO_B64}" width="160" height="32" alt="MEGAWATT" style="display:block" />`;

export function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1a18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1a18;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#0f1f1d;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">

        <!-- Header met SVG logo -->
        <tr>
          <td style="background:#0a1a18;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06)">
            ${LOGO_IMG}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 20px;color:#ffffff;font-size:22px;font-weight:700">${title}</h1>
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06)">
            <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px">
              Megawatt &middot; Activatie &amp; Promotiebureau<br>
              Dit is een automatisch gegenereerde e-mail.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Knop in website-stijl: geel (#ffff00) met donkere tekst — zelfde als dashboard-buttons
export function emailButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0">
    <tr>
      <td style="background:#ffff00;border-radius:10px">
        <a href="${href}" style="display:inline-block;padding:14px 28px;color:#0f1f1d;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.2px">${label}</a>
      </td>
    </tr>
  </table>`;
}

export function emailMeta(rows: [string, string][]): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background:rgba(255,255,255,0.04);border-radius:10px;padding:4px 0;margin:20px 0">
    ${rows.map(([k, v]) => `
    <tr>
      <td style="padding:10px 16px;color:rgba(255,255,255,0.45);font-size:13px;width:40%">${k}</td>
      <td style="padding:10px 16px;color:#ffffff;font-size:13px;font-weight:600">${v}</td>
    </tr>`).join('')}
  </table>`;
}
