const RECIPIENTS = ['joaoparpitero2018@gmail.com'];


function safe(value) {
  return String(value).replace(/[&<>]/g, function(char) {
    return {'&':'&amp;', '<':'&lt;', '>':'&gt;'}[char];
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Metodo nao permitido.'});
  if (!process.env.RESEND_API_KEY) return res.status(500).json({error: 'RESEND_API_KEY nao configurada na Vercel.'});

  const body = req.body || {};
  if (!body.userName || !body.courseName || typeof body.certificateImage !== 'string') {
    return res.status(400).json({error: 'Dados obrigatorios ausentes.'});
  }

  const match = body.certificateImage.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({error: 'Imagem do certificado invalida.'});
  if (match[1].length > 4500000) return res.status(413).json({error: 'Imagem muito grande.'});

  const date = body.completedAt ? new Date(body.completedAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const html = '<h2>Treinamento concluido</h2>' +
    '<p><strong>Usuario:</strong> ' + safe(body.userName) + '</p>' +
    '<p><strong>Curso:</strong> ' + safe(body.courseName) + '</p>' +
    '<p><strong>Nota media:</strong> ' + safe(body.averageScore ?? '-') + '</p>' +
    '<p><strong>Data:</strong> ' + safe(date) + '</p>' +
    '<p>O certificado esta anexado a este e-mail.</p>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'onboarding@resend.dev',
        to: RECIPIENTS,
        subject: 'Curso concluido - ' + body.userName + ' - ' + body.courseName,
        html: html,
        attachments: [{filename: 'certificado.png', content: match[1]}]
      })
    });
    const result = await response.json();
    if (!response.ok) return res.status(response.status).json({error: result.message || 'Servico de e-mail recusou o envio.'});
    return res.status(200).json({ok: true, id: result.id});
  } catch (error) {
    console.error(error);
    return res.status(502).json({error: 'Falha de conexao com o servico de e-mail.'});
  }
};
