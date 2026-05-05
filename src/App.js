import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from "jspdf";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';
import './App.css';

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production'
    ? '/api'
    : 'http://localhost:3001/api'
});

const LogoIcon = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="34" height="34" rx="9" fill="url(#logoGrad)" />
    <path d="M9 17L14.5 22.5L25 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
    </defs>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const UploadCloudIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const FileCheckIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="9 15 11 17 15 13" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="spinner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

function App() {
  const [arquivos, setArquivos] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [historico, setHistorico] = useState(() => {
    const salvo = localStorage.getItem('auditorias_suhai');
    return salvo ? JSON.parse(salvo) : [];
  });

  useEffect(() => {
    localStorage.setItem('auditorias_suhai', JSON.stringify(historico));
  }, [historico]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const temArquivoBloqueado = selectedFiles.some(file =>
      file.name.toLowerCase().endsWith('.zip') ||
      file.name.toLowerCase().endsWith('.rar')
    );

    if (temArquivoBloqueado) {
      setErro("Arquivos compactados (.zip/.rar) não são permitidos. Selecione os documentos individualmente.");
      setArquivos([]);
    } else {
      setArquivos(selectedFiles);
      setErro(null);
    }
  };

  const stats = {
    total: historico.length,
    aprovados: historico.filter(h => h.status_geral === 'APROVADO').length,
    pendentes: historico.filter(h => h.status_geral === 'PENDENTE').length,
  };

  const percentualAprovacao = stats.total > 0 ? Math.round((stats.aprovados / stats.total) * 100) : 0;

  const dataMotivos = [
    { name: 'Assinatura', value: historico.filter(h => h.checklist?.assinatura_conforme_valor === false).length },
    { name: 'Titularidade', value: historico.filter(h => h.checklist?.match_titularidade === false).length },
    { name: 'Sinistro', value: historico.filter(h => h.checklist?.sinistro_consistente === false).length },
  ].filter(m => m.value > 0);

  const pieData = stats.total > 0
    ? [{ v: stats.aprovados }, { v: stats.pendentes }]
    : [{ v: 1 }];

  const handleUpload = async () => {
    if (arquivos.length === 0) {
      setErro("Selecione os documentos válidos para análise.");
      return;
    }

    setLoading(true);
    setResultado(null);
    setErro(null);

    const formData = new FormData();
    arquivos.forEach(f => formData.append('arquivos', f));

    try {
      const response = await api.post('/validar', formData);
      setResultado(response.data);
      setHistorico(prev => [response.data, ...prev].slice(0, 10));
    } catch (err) {
      setErro("Falha na análise. Verifique se o servidor está rodando ou se os arquivos são compatíveis.");
    } finally {
      setLoading(false);
    }
  };

  const exportarPDF = (d) => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.text("LAUDO TÉCNICO SUHAI", 10, 25);
    doc.setTextColor(0, 0, 0); doc.setFontSize(12);
    doc.text(`Status: ${d.status_geral}`, 10, 55);
    doc.text(`Parecer: ${d.parecer_tecnico}`, 10, 70, { maxWidth: 180 });
    doc.save(`laudo_${d.dados_extraidos?.numero_sinistro || 'analise'}.pdf`);
  };

  return (
    <div className={`app-wrapper${mounted ? ' visible' : ''}`}>
      <div className="bg-glow" />

      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="header-logo">
            <LogoIcon />
            <div className="header-brand">
              <h1>AuditWise <span>AI</span></h1>
              <p>Sistema Inteligente de Auditoria de Documentos</p>
            </div>
          </div>
          <div className="status-pill">
            <span className="pulse-dot" />
            Ativo
          </div>
        </header>

        {/* KPI Cards */}
        <section className="dashboard-grid">
          <div className="kpi-card">
            <div className="kpi-icon kpi-icon--green">
              <CheckCircleIcon />
            </div>
            <div className="kpi-info">
              <h3>Taxa de Aprovação</h3>
              <span className="kpi-value">{percentualAprovacao}%</span>
              <p>{stats.aprovados} de {stats.total} processos</p>
            </div>
            <div className="kpi-chart">
              <ResponsiveContainer width="100%" height={80}>
                <PieChart>
                  <Pie data={pieData} innerRadius={24} outerRadius={34} dataKey="v" startAngle={90} endAngle={-270} strokeWidth={0}>
                    {stats.total > 0 ? (
                      <>
                        <Cell fill="#10b981" />
                        <Cell fill="#1a1a2e" />
                      </>
                    ) : (
                      <Cell fill="#1a1a2e" />
                    )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon kpi-icon--amber">
              <AlertTriangleIcon />
            </div>
            <div className="kpi-info">
              <h3>Principais Pendências</h3>
              <p>Frequência de erros por categoria</p>
            </div>
            <div className="kpi-chart">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={dataMotivos}>
                  <Tooltip
                    contentStyle={{ background: '#13131f', border: '1px solid #2d2d4a', borderRadius: '8px', fontSize: '11px', color: '#fafafa' }}
                    cursor={{ fill: 'rgba(124,58,237,0.08)' }}
                  />
                  <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Upload */}
        <main className="upload-section">
          <input
            type="file"
            multiple
            id="file-input"
            onChange={handleFileChange}
            hidden
            accept="image/*,application/pdf"
          />
          <label htmlFor="file-input" className={`dropzone-label${arquivos.length > 0 ? ' has-files' : ''}`}>
            <div className="dropzone-icon">
              {arquivos.length > 0 ? <FileCheckIcon /> : <UploadCloudIcon />}
            </div>
            {arquivos.length > 0 ? (
              <>
                <span className="dropzone-main">{arquivos.length} arquivo{arquivos.length > 1 ? 's' : ''} selecionado{arquivos.length > 1 ? 's' : ''}</span>
                <span className="dropzone-sub">Clique para alterar a seleção</span>
              </>
            ) : (
              <>
                <span className="dropzone-main">Clique ou arraste seus documentos aqui</span>
                <span className="dropzone-sub">Suporta imagens e PDFs · Máx. 10 arquivos</span>
              </>
            )}
          </label>

          <button
            className={`btn-audit${loading ? ' loading' : ''}`}
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? (
              <>
                <SpinnerIcon />
                Auditando documentos...
              </>
            ) : (
              'Iniciar Análise'
            )}
          </button>

          {erro && (
            <div className="error-banner">
              <span>⚠</span>
              {erro}
            </div>
          )}
        </main>

        {/* Result */}
        {resultado && !loading && (
          <section className={`result-card${resultado.status_geral === 'APROVADO' ? ' aprovado' : ' pendente'}`}>
            <div className="result-header">
              <div className="result-status">
                <span className={`status-dot${resultado.status_geral === 'APROVADO' ? ' green' : ' amber'}`} />
                <h2>
                  Resultado:{' '}
                  <span className={resultado.status_geral === 'APROVADO' ? 'text-green' : 'text-amber'}>
                    {resultado.status_geral}
                  </span>
                </h2>
              </div>
              <button onClick={() => exportarPDF(resultado)} className="btn-pdf">
                <DownloadIcon /> Baixar PDF
              </button>
            </div>

            <div className="checklist-container">
              <div className={`check-item${resultado.checklist?.match_titularidade ? ' ok' : ' fail'}`}>
                <span>Titularidade</span>
                <span className="check-mark">{resultado.checklist?.match_titularidade ? '✓' : '✗'}</span>
              </div>
              <div className={`check-item${resultado.checklist?.assinatura_conforme_valor ? ' ok' : ' fail'}`}>
                <span>Assinatura R$ {resultado.valor_indenizacao || '0'}</span>
                <span className="check-mark">{resultado.checklist?.assinatura_conforme_valor ? '✓' : '✗'}</span>
              </div>
            </div>

            <p className="parecer-text">
              <strong>Parecer técnico:</strong> {resultado.parecer_tecnico}
            </p>
          </section>
        )}

        {/* History */}
        <section className="history-section">
          <div className="history-header">
            <h3>Análises Recentes</h3>
            {historico.length > 0 && (
              <span className="history-count">{historico.length}</span>
            )}
          </div>
          <div className="history-list">
            {historico.length === 0 ? (
              <div className="history-empty">Nenhuma análise realizada ainda.</div>
            ) : (
              historico.map((item, i) => (
                <div key={i} className="history-item" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="history-left">
                    <div className="history-dot" />
                    <div>
                      <span className="history-sinistro">
                        Sinistro {item.dados_extraidos?.numero_sinistro || 'N/A'}
                      </span>
                      <span className="history-rule">Regra R$10k/20k aplicada</span>
                    </div>
                  </div>
                  <span className={`badge ${item.status_geral?.toLowerCase()}`}>
                    {item.status_geral}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
