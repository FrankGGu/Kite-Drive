function travelTimeMin(from, to) {
  // demo 用“手写时间矩阵”最稳定（不用外部地图 API）
  const T = {
    "A": { "A": 0,  "B": 18, "C": 45, "D": 12, "E": 22 },
    "B": { "A": 18, "B": 0,  "C": 35, "D": 20, "E": 30 },
    "C": { "A": 45, "B": 35, "C": 0,  "D": 40, "E": 55 },
    "D": { "A": 12, "B": 20, "C": 40, "D": 0,  "E": 25 },
    "E": { "A": 22, "B": 30, "C": 55, "D": 25, "E": 0  }
  };
  return (T[from] && T[from][to] != null) ? T[from][to] : 999;
}

function decideParkingWithScenarios({ scenario, spots }) {
  const thoughts = [];

  // 1) 白名单
  let candidates = spots.filter(s => s.kiteCertified);
  thoughts.push(`Whitelist check: ${candidates.length}/${spots.length} Kite-certified`);

  if (scenario.needCharging) {
    const before = candidates.length;
    candidates = candidates.filter(s => s.hasCharging);
    thoughts.push(`Charging required: kept ${candidates.length}/${before} spots with chargers`);
    if (candidates.length === 0) {
      return { ok: false, thoughts, reason: "No charger-capable spot available" };
    }
  }

  // 2) 计算每个候选的 ETA & 总成本
  const enriched = candidates.map(s => {
    const driveMin = travelTimeMin(scenario.current, s.near) + travelTimeMin(s.near, scenario.destination);
    const etaMin = driveMin + s.queueMin;

    const parkingCost = s.pricePerHourUsd * (scenario.parkingHours ?? 1);

    const chargeCost = scenario.needCharging
      ? (scenario.needKwh ?? 10) * (s.chargingPricePerKwhUsd ?? 0.6)
      : 0;

    const totalCostUsd = +(parkingCost + chargeCost).toFixed(2);

    return {
      ...s,
      driveMin,
      etaMin,
      totalCostUsd
    };
  });

  thoughts.push(`Computed ETA & cost for ${enriched.length} candidates`);

  // 3) 截止时间约束（如果 deadline 很紧）
  const feasible = enriched.filter(x => x.etaMin <= scenario.deadlineMin);
  thoughts.push(`Deadline feasibility: ${feasible.length}/${enriched.length} within ${scenario.deadlineMin} min`);

  if (feasible.length === 0) {
    // 紧急场景：返回“都来不及”的结果，前端可展示“无法满足”
    return { ok: false, thoughts, reason: "No feasible option meets the deadline", candidates: enriched };
  }

  // 4) 评分（可展示）
  const urgency = scenario.urgency;
  const wTime = urgency === "high" ? 0.7 : urgency === "low" ? 0.3 : 0.5;
  const wCost = 1 - wTime;

  const scored = feasible.map(x => {
    // normalize 简化：用 max 做归一（demo 足够）
    const maxEta = Math.max(...feasible.map(a => a.etaMin));
    const maxCost = Math.max(...feasible.map(a => a.totalCostUsd));

    const timeNorm = x.etaMin / (maxEta || 1);
    const costNorm = x.totalCostUsd / (maxCost || 1);

    const score = +(wTime * timeNorm + wCost * costNorm).toFixed(4);
    return { ...x, score };
  }).sort((a, b) => a.score - b.score);

  const best = scored[0];

  thoughts.push(`Scoring weights: time=${wTime}, cost=${wCost}`);
  thoughts.push(`Selected ${best.id} with score=${best.score}, ETA=${best.etaMin}min, cost=$${best.totalCostUsd}`);

  return {
    ok: true,
    thoughts,
    decision: {
      id: best.id,
      name: best.name,
      providerAddress: best.providerAddress,
      etaMin: best.etaMin,
      totalCostUsd: best.totalCostUsd,
      hasCharging: best.hasCharging
    },
    candidatesForLLM: scored.map(x => ({
      id: x.id,
      name: x.name,
      etaMin: x.etaMin,
      queueMin: x.queueMin,
      pricePerHourUsd: x.pricePerHourUsd,
      totalCostUsd: x.totalCostUsd,
      hasCharging: x.hasCharging,
      chargingPricePerKwhUsd: x.chargingPricePerKwhUsd
    }))
  };
}

module.exports = { decideParkingWithScenarios };
