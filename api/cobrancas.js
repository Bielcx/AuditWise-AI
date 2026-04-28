const { Resend } = require('resend');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Inicializações
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// ========================
// TEMPLATES DE EMAIL
// ========================
function montarEmail(pendencia, diaCobranca) {
    const docsHtml = pendencia.documentos_faltantes
        .map(doc => `<li style="margin-bottom:6px;">❌ ${doc}</li>`)
        .join('');

    const sinistro = pendencia.numero_sinistro;

    const mensagens = {
        assunto: {
            1: `[Suhai] Pendência no sinistro #${sinistro} — Documentos necessários`,
            2: `[Suhai] ⚠️ Lembrete — Sinistro #${sinistro} ainda com pendências`,
            3: `[Suhai] 🚨 URGENTE — Prazo vencendo — Sinistro #${sinistro}`,
        },
        titulo: {
            1: 'Documentos Pendentes',
            2: 'Lembrete: Documentos Pendentes',
            3: 'URGENTE: Prazo Vencendo',
        },
        intro: {
            1: `Identificamos que o kit de documentos do sinistro <strong>#${sinistro}</strong> ainda está incompleto. Para darmos continuidade ao seu processo, precisamos que envie os documentos abaixo o quanto antes.`,
            2: `Ainda estamos aguardando os documentos do sinistro <strong>#${sinistro}</strong>. Seu processo pode ser suspenso caso não regularize em breve.`,
            3: `O prazo para envio dos documentos do sinistro <strong>#${sinistro}</strong> está se encerrando. Regularize <strong>hoje</strong> para evitar a suspensão do processo.`,
        },
        cor: {
            1: '#3B82F6',
            2: '#F59E0B',
            3: '#EF4444',
        }
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <tr>
              <td style="background:${mensagens.cor[diaCobranca]};padding:28px 32px;">
                <h1 style="margin:0;color:#fff;font-size:22px;">Suhai Seguradora</h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${mensagens.titulo[diaCobranca]}</p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <p style="color:#1E293B;font-size:15px;line-height:1.6;margin-top:0;">
                  ${mensagens.intro[diaCobranca]}
                </p>

                <!-- Documentos faltando -->
                <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:6px;padding:16px 20px;margin:20px 0;">
                  <p style="margin:0 0 10px;font-weight:bold;color:#991B1B;font-size:14px;">Documentos necessários:</p>
                  <ul style="margin:0;padding-left:20px;color:#7F1D1D;font-size:14px;line-height:1.7;">
                    ${docsHtml}
                  </ul>
                </div>

                <p style="color:#475569;font-size:14px;line-height:1.6;">
                  Por favor, envie os documentos respondendo este email ou entre em contato com o auditor responsável pelo seu processo.
                </p>

                <!-- Número do sinistro -->
                <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:14px 18px;margin:20px 0;">
                  <p style="margin:0;color:#64748B;font-size:13px;">Número do sinistro</p>
                  <p style="margin:4px 0 0;color:#0F172A;font-size:18px;font-weight:bold;">#${sinistro}</p>
                </div>

                <p style="color:#94A3B8;font-size:12px;margin-bottom:0;">
                  Em caso de dúvidas, responda este email ou entre em contato com a Suhai Seguradora.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F8FAFC;padding:18px 32px;border-top:1px solid #E2E8F0;">
                <p style="margin:0;color:#94A3B8;font-size:12px;text-align:center;">
                  Suhai Seguradora · Sistema AuditWise AI · Este é um email automático
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>`;

    return {
        assunto: mensagens.assunto[diaCobranca],
        html
    };
}

// ========================
// EMAIL PARA O AUDITOR
// ========================
function montarEmailAuditor(pendencia) {
    const docsHtml = pendencia.documentos_faltantes
        .map(doc => `<li style="margin-bottom:6px;">${doc}</li>`)
        .join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;background:#F1F5F9;padding:30px;">
      <div style="background:#fff;border-radius:12px;padding:32px;max-width:600px;margin:0 auto;">
        <div style="background:#EF4444;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:24px;">
          <h2 style="margin:0;">⚠️ Intervenção Manual Necessária</h2>
        </div>
        <p style="color:#1E293B;font-size:15px;">
          O sinistro <strong>#${pendencia.numero_sinistro}</strong> passou por <strong>${pendencia.cobrancas_enviadas} cobranças automáticas</strong> sem resposta do terceiro.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="background:#F8FAFC;">
            <td style="padding:10px 14px;border:1px solid #E2E8F0;font-weight:bold;color:#64748B;width:40%;">Sinistro</td>
            <td style="padding:10px 14px;border:1px solid #E2E8F0;color:#0F172A;">#${pendencia.numero_sinistro}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border:1px solid #E2E8F0;font-weight:bold;color:#64748B;">Email terceiro</td>
            <td style="padding:10px 14px;border:1px solid #E2E8F0;color:#0F172A;">${pendencia.email_terceiro || 'Não informado'}</td>
          </tr>
          <tr style="background:#F8FAFC;">
            <td style="padding:10px 14px;border:1px solid #E2E8F0;font-weight:bold;color:#64748B;">Telefone</td>
            <td style="padding:10px 14px;border:1px solid #E2E8F0;color:#0F172A;">${pendencia.telefone_terceiro || 'Não informado'}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border:1px solid #E2E8F0;font-weight:bold;color:#64748B;">Cobranças enviadas</td>
            <td style="padding:10px 14px;border:1px solid #E2E8F0;color:#0F172A;">${pendencia.cobrancas_enviadas}x</td>
          </tr>
        </table>
        <div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:14px 18px;border-radius:6px;">
          <p style="margin:0 0 8px;font-weight:bold;color:#991B1B;">Documentos pendentes:</p>
          <ul style="margin:0;padding-left:20px;color:#7F1D1D;font-size:14px;">
            ${docsHtml}
          </ul>
        </div>
        <p style="color:#64748B;font-size:13px;margin-top:20px;">
          Este sinistro foi marcado como <strong>Escalado</strong> no sistema. É necessária intervenção manual.
        </p>
      </div>
    </body>
    </html>`;

    return html;
}

// ========================
// FUNÇÃO PRINCIPAL
// ========================
async function executarCobrancas() {
    console.log(`[${new Date().toLocaleString('pt-BR')}] Iniciando rodada de cobranças...`);

    const { data: pendencias, error } = await supabase
        .from('pendencias')
        .select('*')
        .eq('status', 'aguardando');

    if (error) {
        console.error('Erro ao buscar pendências:', error.message);
        return;
    }

    if (!pendencias || pendencias.length === 0) {
        console.log('Nenhuma pendência encontrada.');
        return;
    }

    console.log(`${pendencias.length} pendência(s) encontrada(s).`);

    for (const pendencia of pendencias) {
        const diaCobranca = pendencia.cobrancas_enviadas + 1;

        // Dia 4+: escalona para o auditor
        if (diaCobranca > 3) {
            // Notifica o auditor
            await resend.emails.send({
                from: process.env.EMAIL_REMETENTE,
                to: process.env.EMAIL_AUDITOR,
                subject: `[AuditWise] ⚠️ Intervenção necessária — Sinistro #${pendencia.numero_sinistro}`,
                html: montarEmailAuditor(pendencia)
            });

            // Atualiza status para escalado
            await supabase
                .from('pendencias')
                .update({ status: 'escalado', atualizado_em: new Date() })
                .eq('id', pendencia.id);

            console.log(`Sinistro #${pendencia.numero_sinistro} → ESCALADO (auditor notificado)`);
            continue;
        }

        // Envia cobrança para o terceiro (só se tiver email)
        if (pendencia.email_terceiro) {
            const { assunto, html } = montarEmail(pendencia, diaCobranca);

            const { error: emailError } = await resend.emails.send({
                from: process.env.EMAIL_REMETENTE,
                to: pendencia.email_terceiro,
                subject: assunto,
                html
            });

            if (emailError) {
                console.error(`Erro ao enviar email — Sinistro #${pendencia.numero_sinistro}:`, emailError.message);
                continue;
            }

            // Registra no log
            await supabase.from('log_cobrancas').insert({
                pendencia_id: pendencia.id,
                canal: 'email',
                mensagem: `Cobrança dia ${diaCobranca} enviada para ${pendencia.email_terceiro}`
            });
        }

        // Atualiza contador de cobranças
        await supabase
            .from('pendencias')
            .update({
                cobrancas_enviadas: diaCobranca,
                atualizado_em: new Date()
            })
            .eq('id', pendencia.id);

        console.log(`Sinistro #${pendencia.numero_sinistro} → Cobrança dia ${diaCobranca} enviada`);
    }

    console.log('Rodada de cobranças finalizada.');
}

// ========================
// AGENDADOR — Todo dia às 9h
// ========================
cron.schedule('0 9 * * *', executarCobrancas, {
    timezone: 'America/Sao_Paulo'
});

console.log('Sistema de cobranças automáticas iniciado — rodará todo dia às 9h (horário de Brasília)');

// Exporta para testes manuais
module.exports = { executarCobrancas };