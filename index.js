import rateLimit from 'express-rate-limit';
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = 3001;

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

app.post('/validar-sinistro', upload.array('arquivos', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhum ficheiro foi enviado.' });
        }

        console.log(`Recebidos ${req.files.length} ficheiros para análise.`);

        // Instancia o modelo Gemini 3 Flash
        const model = genAI.getGenerativeModel(
        { model: "gemini-3-flash-preview" },
        { apiVersion: "v1beta" },
        {generationConfig: {
            temperature: 0, // Essencial para auditoria
            responseMimeType: "application/json", // Força o retorno em JSON
        }}
        );

        const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 20, // limite de 20 requisições por IP
        message: "Muitas solicitações vindas deste IP, tente novamente após 15 minutos."
        });

        app.use("/api/analyze", limiter);

        // Converte todos os ficheiros para o formato que a IA entende
        const imageParts = req.files.map(file => ({
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype,
            },
        }));

        // Super Prompt de Auditoria e Cruzamento de Dados
        const prompt = `
            Você é um auditor jurídico rigoroso. Sua função é REPROVAR documentos, 
            a menos que você tenha certeza absoluta de que estão corretos.

            REGRA CRÍTICA: Se um campo obrigatório estiver em branco, contiver apenas 
            traços (___), apenas espaços, ou se você não conseguir ler o conteúdo com 
            clareza, classifique como VAZIO e REPROVE. NUNCA infira ou suponha o valor 
            de um campo que não está claramente preenchido.

            Analise os seguintes campos no Termo de Acordo:
            - Cláusula 2: Placa do veículo do Terceiro → deve estar preenchida com 
            formato XXX0000 ou XXX0X00. Se contiver apenas traços ou estiver em 
            branco: REPROVAR.

            Retorne SOMENTE um JSON válido com este schema:
            {
            "aprovado": boolean,
            "motivos_reprovacao": string[],
            "campos_auditados": {
                "nome_cnh": { "valor": string | null, "status": "preenchido" | "vazio" | "ilegivel" },
                "placa_crlv": { ... },
                "placa_termo_clausula2": { ... }
            }
            }
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

app.listen(port, () => {
    console.log(`🚀 API de Auditoria Suhai rodando em http://localhost:${port}`);
});