const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
require('./cobrancas'); // inicia o agendador de cobranças

const app = express();
const PORT = process.env.PORT || 3001;

// Configurações de Middleware
app.use(cors());
app.set('trust proxy', 1);
app.use(express.json());

// Rate limiter configurado FORA da rota (correto)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20,
    message: "Muitas solicitações vindas deste IP, tente novamente após 15 minutos."
});
app.use("/api/validar", limiter);

// Configuração Multer
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB por arquivo
});

// Inicialização da Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Inicialização do Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

app.post('/api/validar', upload.array('arquivos', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhum ficheiro foi enviado.' });
        }

        console.log(`Recebidos ${req.files.length} ficheiros para análise.`);

        // Instancia o modelo Gemini
        const model = genAI.getGenerativeModel(
            { model: "gemini-2.0-flash" }, // modelo estável
            { apiVersion: "v1beta" }
        );

        // Converte arquivos para o formato da IA
        const imageParts = req.files.map(file => ({
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype,
            },
        }));

        // Prompt de Auditoria
        const prompt = `
            Você é um Auditor de Sinistros Sênior da Suhai Seguradora. Sua missão é validar um kit de documentos de terceiros com tolerância zero para campos obrigatórios vazios.

            REGRAS DE OURO PARA VALIDAÇÃO:
            1. TITULARIDADE: O nome no CRLV/DUT deve ser EXATAMENTE igual à CNH, ao Formulário de Indenização e ao Termo de Acordo.
            2. SINISTRO: O número do sinistro deve ser idêntico em todos os formulários.
            3. REGRA DE ASSINATURA POR VALOR (CRÍTICO):
            - Até R$ 10.000,00: Aceitar assinatura a punho (manuscrita).
            - Entre R$ 10.000,01 e R$ 20.000,00: Obrigatório assinatura digital GOV.BR.
            - Acima de R$ 20.000,00: Obrigatório reconhecimento de firma POR AUTENTICIDADE (selo de cartório).

            4. INTEGRIDADE E CAMPOS EM BRANCO (ESTRITA):
            - Localize a Cláusula 2 do Termo de Acordo ("veículo do Terceiro... placa ________").
            - Se após as palavras "placa", "chassi", "valor de R$" ou "Favorecido" houver apenas a linha tracejada, espaço vazio ou sublinhados, gere status PENDENTE.
            - O campo "placa" na Cláusula 2 é obrigatório; se não houver texto manuscrito ou digitado sobre a linha, reprove imediatamente.

            PENSAMENTO LÓGICO:
            Antes de gerar o JSON, verifique: "Eu consigo ler uma placa escrita no Termo?". Se a resposta for "não" ou "apenas vejo a linha tracejada", o checklist de integridade falhou.

            JSON de Saída:
            {
            "status_geral": "APROVADO" ou "PENDENTE",
            "valor_indenizacao": number,
            "parecer_tecnico": "Explicação detalhada. Se houver campo vazio, especifique qual (ex: Placa ausente no Termo).",
            "dados_extraidos": { "favorecido": "", "proprietario_crlv": "", "numero_sinistro": "" },
            "checklist": {
                "match_titularidade": boolean,
                "sinistro_consistente": boolean,
                "assinatura_conforme_valor": boolean,
                "preenchimento_integral": boolean
            }
            }
            Analise os documentos anexados e retorne apenas o JSON.
        `;

        // Chama a IA
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Limpa e parseia o JSON
        const cleanJson = text.replace(/```json|```/g, "").trim();
        const resultadoFinal = JSON.parse(cleanJson);

        // ✅ PASSO 5: Se PENDENTE, registra no Supabase automaticamente
        if (resultadoFinal.status_geral === 'PENDENTE') {
            const docsFaltando = [];

            if (!resultadoFinal.checklist?.match_titularidade)
                docsFaltando.push('Titularidade divergente entre documentos');
            if (!resultadoFinal.checklist?.assinatura_conforme_valor)
                docsFaltando.push('Assinatura incorreta para o valor da indenização');
            if (!resultadoFinal.checklist?.preenchimento_integral)
                docsFaltando.push('Campos obrigatórios vazios (placa, chassi ou valor)');
            if (!resultadoFinal.checklist?.sinistro_consistente)
                docsFaltando.push('Número de sinistro divergente entre documentos');

            const { error: supabaseError } = await supabase
                .from('pendencias')
                .insert({
                    numero_sinistro: resultadoFinal.dados_extraidos?.numero_sinistro || 'N/A',
                    documentos_faltantes: docsFaltando,
                    status: 'aguardando',
                    // telefone e email serão preenchidos manualmente no Supabase por enquanto
                });

            if (supabaseError) {
                console.error('Erro ao salvar pendência no Supabase:', supabaseError.message);
            } else {
                console.log(`Pendência registrada no Supabase — Sinistro #${resultadoFinal.dados_extraidos?.numero_sinistro}`);
            }
        }

        console.log("Análise concluída com sucesso.");
        res.json(resultadoFinal);

    } catch (error) {
        console.error("Erro na análise da IA:", error);
        res.status(500).json({ 
            status_geral: "ERRO", 
            parecer_tecnico: "Erro interno ao processar os documentos. Verifique a chave da API ou o formato dos ficheiros." 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;