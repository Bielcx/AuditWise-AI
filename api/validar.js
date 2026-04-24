const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurações de Middleware
app.use(cors());
app.use(express.json());

// Configuração Multer: Aceita até 5 ficheiros (PDF ou Imagens)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB por ficheiro
});

// Inicialização da Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/validar', upload.array('arquivos', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhum ficheiro foi enviado.' });
        }

        console.log(`Recebidos ${req.files.length} ficheiros para análise.`);

        // Instancia o modelo Gemini 3 Flash
         // Instancia o modelo Gemini 3 Flash
        const model = genAI.getGenerativeModel(
        { model: "gemini-3-flash-preview" },
        { apiVersion: "v1beta" }
        );

        // ANTES do app.post(...)
        const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: "Muitas solicitações..."
        });
        app.use("/api/validar", limiter); // aplica na rota correta

        // Converte todos os ficheiros para o formato que a IA entende
        const imageParts = req.files.map(file => ({
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype,
            },
        }));

        // Super Prompt de Auditoria e Cruzamento de Dados
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

        // Chama a IA enviando o prompt e a lista de documentos
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Limpeza de segurança para garantir que o JSON seja lido corretamente
        const cleanJson = text.replace(/```json|```/g, "").trim();
        const resultadoFinal = JSON.parse(cleanJson);

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