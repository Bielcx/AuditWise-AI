# AuditWise AI 🤖

> Sistema inteligente de auditoria de documentos com IA — analisa kits de documentos em segundos, identifica pendências automaticamente e dispara cobranças por email.

![Demo](https://img.shields.io/badge/status-live-brightgreen) ![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

**[🚀 Ver projeto ao vivo](https://audit-wise-ai.vercel.app)**

---

## 📋 Sobre o Projeto

O **AuditWise AI** nasceu de uma necessidade real: automatizar a auditoria manual de kits de documentos de sinistros que chegavam diariamente via WhatsApp.

Antes, cada kit era verificado manualmente — conferindo titularidade, assinaturas, campos obrigatórios e regras específicas por faixa de valor. Um processo que consumia horas por dia.

Com o AuditWise AI, o mesmo processo acontece em **menos de 30 segundos**, com laudo técnico detalhado e cobrança automática para quem tiver pendências.

---

## ✨ Funcionalidades

- 📄 **Análise com IA** — Upload de múltiplos documentos (PDF/imagens) e análise automática com Google Gemini
- ✅ **Checklist automático** — Valida titularidade, assinaturas, campos obrigatórios e consistência do sinistro
- 📊 **Dashboard de KPIs** — Taxa de aprovação, principais pendências e histórico de análises
- 📧 **Cobranças automáticas** — Emails profissionais disparados automaticamente para quem tem documentos pendentes
- ⏰ **Agendador diário** — Cron job que roda todo dia às 9h cobrando pendências automaticamente
- 📋 **Laudo em PDF** — Export automático do parecer técnico em PDF profissional
- 🗄️ **Registro no banco** — Toda pendência registrada automaticamente no Supabase com histórico completo

---

## 🔄 Fluxo do Sistema

```
Usuário envia documentos (PDF/Imagens)
            ↓
     IA analisa o kit completo
            ↓
    ┌───────┴───────┐
 APROVADO        PENDENTE
    ↓                ↓
 Laudo PDF    Registra no banco
 gerado       + lista pendências
                     ↓
          Email automático ao terceiro
                     ↓
          Cobrança diária às 9h até
          regularizar (máx. 3 dias)
                     ↓
          Auditor notificado para
          intervenção manual
```

---

## 🛠️ Tecnologias

### Frontend
- **React 19** — Interface do usuário
- **Recharts** — Gráficos do dashboard
- **jsPDF** — Geração de laudos em PDF
- **Axios** — Comunicação com a API

### Backend
- **Node.js + Express** — Servidor da API
- **Multer** — Upload de múltiplos arquivos
- **Google Gemini AI** — Análise inteligente de documentos
- **Supabase** — Banco de dados e armazenamento
- **Resend** — Disparo de emails transacionais
- **node-cron** — Agendamento de cobranças automáticas

### Infraestrutura
- **Vercel** — Deploy do frontend e serverless functions
- **Vercel Cron Jobs** — Agendador em produção
- **Railway** — Servidor para Evolution API (WhatsApp)

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- Conta no [Google AI Studio](https://aistudio.google.com) (chave Gemini)
- Conta no [Supabase](https://supabase.com)
- Conta no [Resend](https://resend.com)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/Bielcx/AuditWise-AI.git
cd AuditWise-AI

# Instale as dependências
npm install
```

### Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
GEMINI_API_KEY=sua_chave_gemini
SUPABASE_URL=sua_url_supabase
SUPABASE_ANON_KEY=sua_chave_supabase
RESEND_API_KEY=sua_chave_resend
EMAIL_REMETENTE=onboarding@resend.dev
EMAIL_AUDITOR=seu_email@exemplo.com
CRON_SECRET=sua_senha_secreta
```

### Banco de dados

Execute no **SQL Editor** do Supabase:

```sql
CREATE TABLE pendencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_sinistro TEXT NOT NULL,
  telefone_terceiro TEXT,
  email_terceiro TEXT,
  documentos_faltantes TEXT[] NOT NULL,
  cobrancas_enviadas INTEGER DEFAULT 0,
  status TEXT DEFAULT 'aguardando',
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE log_cobrancas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pendencia_id UUID REFERENCES pendencias(id),
  canal TEXT,
  mensagem TEXT,
  enviado_em TIMESTAMP DEFAULT NOW()
);
```

### Rodando o projeto

```bash
# Terminal 1 — Backend (porta 3001)
npm run server

# Terminal 2 — Frontend (porta 3000)
npm start
```

Acesse **http://localhost:3000**

---

## 📁 Estrutura do Projeto

```
AuditWise-AI/
├── api/
│   ├── validar.js          # Endpoint de análise com IA
│   ├── cobrancas.js        # Sistema de cobranças automáticas
│   └── cron-cobrancas.js   # Handler do cron job Vercel
├── src/
│   ├── App.js              # Componente principal React
│   ├── App.css             # Estilos do dashboard
│   └── index.js            # Entry point
├── .env.example            # Variáveis de ambiente necessárias
├── vercel.json             # Configuração Vercel + Cron Jobs
└── package.json
```

---

## 🧠 Como a IA Analisa os Documentos

O sistema usa o **Google Gemini** com um prompt especializado que verifica:

| Regra | Descrição |
|---|---|
| **Titularidade** | Nome idêntico no CRLV, CNH, Formulário e Termo |
| **Consistência** | Número do sinistro igual em todos os documentos |
| **Assinatura até R$10k** | Aceita assinatura manuscrita |
| **Assinatura R$10k-20k** | Obrigatório assinatura digital GOV.BR |
| **Assinatura acima R$20k** | Obrigatório reconhecimento de firma em cartório |
| **Campos obrigatórios** | Placa, chassi, valor e favorecido preenchidos |

---

## 📧 Sistema de Cobranças Automáticas

Quando um kit vem com pendências, o sistema:

| Dia | Ação |
|---|---|
| **Dia 1** | Email amigável listando documentos faltantes |
| **Dia 2** | Email de lembrete com tom de urgência |
| **Dia 3** | Email de aviso de suspensão do processo |
| **Dia 4+** | Auditor notificado para intervenção manual |

---

## 🌐 Deploy

O projeto está configurado para deploy automático na **Vercel**:

```bash
# Após configurar as variáveis de ambiente na Vercel
git push origin main
# Deploy automático via GitHub integration
```

### Variáveis necessárias na Vercel
Configure em **Settings → Environment Variables**:
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `EMAIL_REMETENTE`
- `EMAIL_AUDITOR`
- `CRON_SECRET`

---

## 📈 Resultados

| Métrica | Antes | Depois |
|---|---|---|
| Tempo por kit | ~15 minutos | ~30 segundos |
| Cobranças manuais | Diárias por telefone/email | Automáticas às 9h |
| Registro de pendências | Planilha manual | Banco de dados automático |
| Laudo técnico | Não existia | PDF gerado automaticamente |

---

## 🔮 Próximas Funcionalidades

- [ ] Bot WhatsApp para recebimento automático de documentos
- [ ] Integração com sistema i4Pro via RPA
- [ ] Dashboard gerencial com relatórios mensais
- [ ] Autenticação e controle de acesso por usuário
- [ ] Notificações por WhatsApp além de email

---

## 👨‍💻 Autor

Desenvolvido por **Gabriel (Biel)**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/seu-perfil)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/Bielcx)

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.