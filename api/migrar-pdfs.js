export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido'
    });
  }

  try {
    const {
      cursoId,
      moduleOrder,
      lessonOrder,
      pdfUrl
    } = req.body;

    if (!cursoId || !moduleOrder || !lessonOrder || !pdfUrl) {
      return res.status(400).json({
        error: 'Dados incompletos'
      });
    }

    // Baixa o PDF no servidor
    const resposta = await fetch(pdfUrl);

    if (!resposta.ok) {
      return res.status(500).json({
        error: `Erro ao baixar PDF: ${resposta.status}`
      });
    }

    const pdfBuffer = Buffer.from(
      await resposta.arrayBuffer()
    );

    // Nome do arquivo
    const nomeArquivo =
      `${cursoId}/${moduleOrder}-${lessonOrder}-${Date.now()}.pdf`;

    // Envia para o Storage do Supabase
    const upload = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/course-pdfs/${nomeArquivo}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/pdf'
        },
        body: pdfBuffer
      }
    );

    if (!upload.ok) {
      const erroUpload = await upload.text();

      return res.status(500).json({
        error: 'Erro ao enviar para o Storage',
        detalhes: erroUpload
      });
    }

    // URL pública
    const novaUrl =
      `${process.env.SUPABASE_URL}/storage/v1/object/public/course-pdfs/${nomeArquivo}`;

    // Atualiza a aula no banco
    const rpc = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/atualizar_url_aula_caw`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_course_id: cursoId,
          p_module_order: moduleOrder,
          p_lesson_order: lessonOrder,
          p_url: novaUrl
        })
      }
    );

    if (!rpc.ok) {
      const erroRpc = await rpc.text();

      return res.status(500).json({
        error: 'PDF enviado, mas não atualizou a aula',
        detalhes: erroRpc
      });
    }

    return res.status(200).json({
      sucesso: true,
      url: novaUrl
    });

  } catch (erro) {
    console.error('Erro na migração:', erro);

    return res.status(500).json({
      error: 'Erro interno',
      detalhes: erro.message
    });
  }
}