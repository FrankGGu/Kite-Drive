require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { decideParking } = require('./agent');
const { pay } = require('./pay');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/reserve', async (req, res) => {
  try {
    const urgency = req.body?.urgency ?? 'normal';

    const parks = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'parking.json'), 'utf-8')
    );

    const agentResult = decideParking({
      parks,
      urgency,
      maxOverMarketPct: 0.2,
      maxSingleTxKite: 2
    });

    if (!agentResult.ok) {
      return res.status(400).json({ ok: false, ...agentResult });
    }

    // 触发支付：把“预计停车费”转给 providerAddress（演示用）
    const payment = await pay({
      to: agentResult.decision.providerAddress,
      amountKite: 0.0001 // 建议 demo 固定小额；或用 agentResult.decision.estimatedCostKite
    });

    return res.json({
      ok: true,
      agent: agentResult,
      payment,
      explorer: `https://testnet.kitescan.ai/tx/${payment.txHash}`
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

app.listen(3001, () => {
  console.log('Agent service listening on http://localhost:3001');
});
