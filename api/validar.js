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

// Middlewares
app.use(cors());
app.set('trust proxy', 1); // necessário para rate limit funcionar na Vercel
app.use(express.json());

// Rate limiter — fora da rota para funcionar corretamente
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Muitas solicitações vindas deste IP, tente novamente após 15 minutos."
});
app.use("/api/validar", limiter);

// Multer — armazenamento em memória, limite de 10MB por arquivo
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Inicialização dos serviços
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// ========================
// ROTA PRINCIPAL — Análise de documentos
// ========================
app.post('/api/validar', upload.array('arquivos', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
        }

        console.log(`Recebidos ${req.files.length} arquivo(s) para análise.`);

        const model = genAI.getGenerativeModel(
            { model: "gemini-3-flash-preview" },
            { apiVersion: "v1beta" }
        );

        const imageParts = req.files.map(file => ({
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype,
            },
        }));

        const prompt = `
            Você é um Auditor de Sinistros Sênior. Sua missão é validar um kit de documentos
            de terceiros com tolerância zero para campos obrigatórios vazios.

            REGRAS DE VALIDAÇÃO:
            1. TITULARIDADE: O nome no CRLV/DUT deve ser EXATAMENTE igual à CNH,
               ao Formulário de Indenização e ao Termo de Acordo.
            2. SINISTRO: O número do sinistro deve ser idêntico em todos os formulários.
            3. REGRA DE ASSINATURA POR VALOR:
               - Até R$ 10.000,00: aceitar assinatura manuscrita.
               - Entre R$ 10.000,01 e R$ 20.000,00: obrigatório assinatura digital GOV.BR.
               - Acima de R$ 20.000,00: obrigatório reconhecimento de firma em cartório.
            4. CAMPOS OBRIGATÓRIOS: Se após "placa", "chassi", "valor de R$" ou "Favorecido"
               houver apenas linha tracejada ou espaço vazio, gere status PENDENTE.

            PENSAMENTO LÓGICO:
            Antes de gerar o JSON, verifique: "Consigo ler uma placa escrita no Termo?".
            Se não ou se apenas vejo a linha tracejada, o checklist de integridade falhou.

            Retorne APENAS o JSON abaixo, sem texto adicional:
            {
                "status_geral": "APROVADO" ou "PENDENTE",
                "valor_indenizacao": number,
                "parecer_tecnico": "Explicação detalhada das pendências encontradas.",
                "dados_extraidos": {
                    "favorecido": "",
                    "proprietario_crlv": "",
                    "numero_sinistro": ""
                },
                "checklist": {
                    "match_titularidade": boolean,
                    "sinistro_consistente": boolean,
                    "assinatura_conforme_valor": boolean,
                    "preenchimento_integral": boolean
                }
            }
        `;

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        const cleanJson = text.replace(/```json|```/g, "").trim();
        const resultadoFinal = JSON.parse(cleanJson);

        // Se PENDENTE, registra automaticamente no Supabase
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
                });

            if (supabaseError) {
                console.error('Erro ao salvar pendência no Supabase:', supabaseError.message);
            } else {
                console.log(`Pendência registrada — Sinistro #${resultadoFinal.dados_extraidos?.numero_sinistro}`);
            }
        }

        console.log("Análise concluída com sucesso.");
        res.json(resultadoFinal);

    } catch (error) {
        console.error("Erro na análise:", error);
        res.status(500).json({ 
            status_geral: "ERRO", 
            parecer_tecnico: "Erro interno ao processar os documentos. Verifique a chave da API ou o formato dos arquivos." 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;