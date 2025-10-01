export async function sendCredentialsEmail(opts: {
  to: string
  subject?: string
  emailBody?: string
  emailFrom?: string
  emailReplyTo?: string
  emailName?: string
  emailPassword?: string
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    // No email provider configured; skip silently
    return { ok: false, skipped: true }
  }
  const from = opts.emailFrom || "admin@bizuri.shop"
  const subject = opts.subject || "Vos identifiants Bizuri"
  const html =
    opts.emailBody ||
    `<p>Bonjour,</p><p>Votre compte a été créé.</p><p>Email: <b>${opts.to}</b><br/>Mot de passe: <b>${opts.emailPassword || "(défini par admin)"}</b></p>`

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject,
      html,
      reply_to: opts.emailReplyTo ? [opts.emailReplyTo] : undefined,
    }),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "")
    return { ok: false, error: txt || `HTTP ${resp.status}` }
  }
  return { ok: true }
}
