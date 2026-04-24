import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from "jspdf";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';
import './App.css';

// Configuração da API: Se estiver em produção, usa caminho relativo '/api'. 
// Se estiver local, usa o seu servidor Node na porta 3001.
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api' 
    : 'http://localhost:3001/api' // Note que o vercel dev usa a porta 3000 para ambos
});

function App() {
  const [arquivos, setArquivos] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  
  const [historico, setHistorico] = useState(() => {
    const salvo = localStorage.getItem('auditorias_suhai');
    return salvo ? JSON.parse(salvo) : [];
  });

  useEffect(() => {
    localStorage.setItem('auditorias_suhai', JSON.stringify(historico));
  }, [historico]);

  // Bloqueio de arquivos compactados na seleção
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const temArquivoBloqueado = selectedFiles.some(file => 
      file.name.toLowerCase().endsWith('.zip') || 
      file.name.toLowerCase().endsWith('.rar')
    );

    if (temArquivoBloqueado) {
      setErro("Arquivos compactados (.zip/.rar) não são permitidos. Selecione os documentos individualmente.");
      setArquivos([]); // Limpa a seleção por segurança
    } else {
      setArquivos(selectedFiles);
      setErro(null);
    }
  };

  // Cálculos para o Dashboard de KPIs
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
    <div className="container">
      <header className="header">
        <h1>Suhai <span>Auditor Pro</span></h1>
        <p>Dashboard de Compliance e Indicadores Operacionais</p>
      </header>

      {/* Seção de KPIs */}
      <section className="dashboard-grid">
        <div className="kpi-card">
          <div className="kpi-info">
            <h3>Taxa de Aprovação</h3>
            <span className="kpi-value">{percentualAprovacao}%</span>
            <p>{stats.aprovados} de {stats.total} processos</p>
          </div>
          <div className="kpi-chart">
            <ResponsiveContainer width="100%" height={80}>
              <PieChart>
                <Pie data={[{v: stats.aprovados}, {v: stats.pendentes}]} innerRadius={25} outerRadius={35} dataKey="v">
                  <Cell fill="#10b981" /><Cell fill="#ef4444" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-info">
            <h3>Principais Pendências</h3>
            <p>Frequência de erros</p>
          </div>
          <div className="kpi-chart">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={dataMotivos}>
                <Tooltip contentStyle={{background: '#1e293b', border: 'none', borderRadius: '5px', fontSize: '10px'}} />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <main className="upload-section">
        <div className="dropzone-box">
          <input 
            type="file" 
            multiple 
            id="file-input" 
            onChange={handleFileChange} 
            hidden 
            accept="image/*,application/pdf"
          />
          <label htmlFor="file-input" className="dropzone-label">
            {arquivos.length > 0 ? `${arquivos.length} arquivos selecionados` : "Carregar Kit de Documentos (Imagens ou PDF)"}
          </label>
        </div>
        <button className="btn-audit" onClick={handleUpload} disabled={loading}>
          {loading ? "AUDITANDO..." : "INICIAR ANÁLISE"}
        </button>
        {erro && <div className="error-banner">{erro}</div>}
      </main>

      {resultado && !loading && (
        <section className={`result-card ${resultado.status_geral === 'APROVADO' ? 'aprovado' : ''}`}>
          <div className="result-header">
            <h2>Status: {resultado.status_geral}</h2>
            <button onClick={() => exportarPDF(resultado)} className="btn-pdf">Baixar PDF</button>
          </div>

          <div className="checklist-container">
            <div className={`check-item ${resultado.checklist?.match_titularidade ? 'ok' : 'fail'}`}>
              Titularidade: {resultado.checklist?.match_titularidade ? '✅' : '❌'}
            </div>
            <div className={`check-item ${resultado.checklist?.assinatura_conforme_valor ? 'ok' : 'fail'}`}>
              Assinatura R$ {resultado.valor_indenizacao || '0'}: {resultado.checklist?.assinatura_conforme_valor ? '✅' : '❌'}
            </div>
          </div>

          <p className="parecer-text"><strong>Parecer:</strong> {resultado.parecer_tecnico}</p>
        </section>
      )}

      <section className="history-section">
        <h3>Análises Recentes</h3>
        <div className="history-list">
          {historico.map((item, i) => (
            <div key={i} className="history-item">
              <div className="history-info">
                <span className="history-sinistro">Sinistro: {item.dados_extraidos?.numero_sinistro || 'N/A'}</span>
                <span className="history-date"> | Regra R$10k/20k aplicada</span>
              </div>
              <span className={`badge ${item.status_geral?.toLowerCase()}`}>{item.status_geral}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;