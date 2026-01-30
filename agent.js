function decideParking({ parks, urgency = 'normal', maxOverMarketPct = 0.2, maxSingleTxKite = 0.002 }) {
  const thoughts = [];

  // 1) 白名单过滤（Kite Certified）
  const whitelisted = parks.filter(p => p.kiteCertified);
  thoughts.push(`Checked whitelist: ${whitelisted.length}/${parks.length} providers are Kite-certified`);

  if (whitelisted.length === 0) {
    return { ok: false, thoughts, reason: 'No certified providers available' };
  }

  // 2) 市场均价（用来做“限价规则：不超过均价 20%”）
  const avg = whitelisted.reduce((s, p) => s + p.pricePerHour, 0) / whitelisted.length;
  const maxAllowed = avg * (1 + maxOverMarketPct);
  thoughts.push(`Market avg price/hr=${avg.toFixed(2)}, maxAllowed=${maxAllowed.toFixed(2)} (avg + ${maxOverMarketPct*100}%)`);

  const priceOk = whitelisted.filter(p => p.pricePerHour <= maxAllowed);
  thoughts.push(`Price filter: ${priceOk.length}/${whitelisted.length} remain`);

  if (priceOk.length === 0) {
    return { ok: false, thoughts, reason: 'All providers exceed price limit' };
  }

  // 3) 单笔限额（这里用“预计1小时停车费”做演示）
  const budgetOk = priceOk.filter(p => p.pricePerHour <= maxSingleTxKite);
  thoughts.push(`Budget filter (<= ${maxSingleTxKite} KITE): ${budgetOk.length}/${priceOk.length} remain`);

  if (budgetOk.length === 0) {
    return { ok: false, thoughts, reason: 'All providers exceed single-tx budget' };
  }

  // 4) 评分：便宜 vs 等待 vs 距离（紧急程度影响权重）
  const wQueue = urgency === 'high' ? 0.08 : 0.03;
  const wDist = urgency === 'high' ? 0.25 : 0.15;

  const scored = budgetOk.map(p => {
    const score = p.pricePerHour + wQueue * p.queueMin + wDist * p.distanceKm;
    return { ...p, score };
  }).sort((a, b) => a.score - b.score);

  const best = scored[0];
  thoughts.push(`Selected ${best.id}: score=${best.score.toFixed(3)} (price + queue + distance)`);

  return {
    ok: true,
    thoughts,
    decision: {
      id: best.id,
      name: best.name,
      providerAddress: best.providerAddress,
      estimatedCostKite: best.pricePerHour,
      distanceKm: best.distanceKm,
      queueMin: best.queueMin
    }
  };
}

module.exports = { decideParking };
