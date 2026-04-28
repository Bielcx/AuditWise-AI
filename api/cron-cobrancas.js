const { executarCobrancas } = require('./cobrancas');

module.exports = async (req, res) => {
    // Segurança: só aceita chamada da própria Vercel
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    try {
        await executarCobrancas();
        res.status(200).json({ ok: true, message: 'Cobranças executadas com sucesso' });
    } catch (error) {
        console.error('Erro no cron:', error);
        res.status(500).json({ error: 'Erro ao executar cobranças' });
    }
};