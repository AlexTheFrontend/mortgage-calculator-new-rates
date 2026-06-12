import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './App.css';

function App() {
  const [balance, setBalance] = useState(337000);
  const [currentRate, setCurrentRate] = useState(5.99);
  const [currentPayment, setCurrentPayment] = useState(2413.14);
  const [newRate, setNewRate] = useState(5.19);
  const [extraMonthly, setExtraMonthly] = useState(200);
  const [extraLumpSum, setExtraLumpSum] = useState(0);
  const [lumpSumMonth, setLumpSumMonth] = useState(1);
  const [calculations, setCalculations] = useState(null);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Utilities
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-NZ');
  const fmtDec = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const termStr = (months) => {
    const y = Math.floor(months / 12);
    const m = months % 12;
    return y + (m > 0 ? ` yr ${m} mo` : ' yr');
  };

  // Standard loan: fixed monthly payment
  const calcLoan = (balance, annualRate, monthlyPayment) => {
    const r = annualRate / 100 / 12;
    if (r <= 0 || monthlyPayment <= balance * r) return null;
    const months = Math.ceil(-Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r));
    if (!isFinite(months) || months <= 0 || months > 1200) return null;
    let bal = balance;
    let totalInterest = 0;
    const schedule = [balance];
    for (let i = 0; i < months; i++) {
      const interest = bal * r;
      totalInterest += interest;
      bal = Math.max(0, bal + interest - monthlyPayment);
      schedule.push(bal);
    }
    return { months, totalInterest, schedule };
  };

  // Minimum payment formula for a given term
  const calcMinPayment = (balance, annualRate, months) => {
    const r = annualRate / 100 / 12;
    if (r === 0) return balance / months;
    return (balance * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  };

  // Loan with variable extra: extra monthly + one-off lump sum at a specific month
  const calcLoanExtra = (balance, annualRate, minPayment, extraMon, lumpSum, lumpSumMon) => {
    const r = annualRate / 100 / 12;
    if (r <= 0) return null;
    let bal = balance;
    let totalInterest = 0;
    let months = 0;
    const schedule = [balance];
    const MAX = 1200;
    while (bal > 0.01 && months < MAX) {
      months++;
      // Apply lump sum at the specified month
      if (months === lumpSumMon && lumpSum > 0) {
        bal = Math.max(0, bal - lumpSum);
      }
      const interest = bal * r;
      totalInterest += interest;
      const payment = Math.min(bal + interest, minPayment + extraMon);
      bal = Math.max(0, bal + interest - payment);
      schedule.push(bal);
    }
    return { months, totalInterest, schedule };
  };

  // Main render logic
  useEffect(() => {
    const curr = calcLoan(balance, currentRate, currentPayment);
    if (!curr) return;

    const newMinPmt = calcMinPayment(balance, newRate, curr.months);
    const newLoan = calcLoan(balance, newRate, newMinPmt);
    if (!newLoan) return;

    const extra = calcLoanExtra(balance, newRate, newMinPmt, extraMonthly, extraLumpSum, lumpSumMonth);
    if (!extra) return;

    const monthlySaving = currentPayment - newMinPmt;
    const totalSaving = curr.totalInterest - newLoan.totalInterest;
    const monthsSaved = newLoan.months - extra.months;
    const interestSavedExtra = newLoan.totalInterest - extra.totalInterest;

    setCalculations({
      currTerm: termStr(curr.months),
      currPayment: currentPayment,
      currInterest: curr.totalInterest,
      currTotal: balance + curr.totalInterest,
      newTerm: termStr(newLoan.months),
      newPayment: newMinPmt,
      newInterest: newLoan.totalInterest,
      newTotal: balance + newLoan.totalInterest,
      extraTerm: termStr(extra.months),
      extraPayment: newMinPmt + extraMonthly,
      extraInterest: extra.totalInterest,
      extraTotal: balance + extra.totalInterest,
      monthlySaving,
      totalSaving,
      monthsSaved,
      interestSavedExtra,
      currSchedule: curr.schedule,
      newSchedule: newLoan.schedule,
      extraSchedule: extra.schedule,
    });

    // Update chart
    const maxMonths = curr.months;
    const step = Math.max(1, Math.floor(maxMonths / 80));
    const labels = [];
    const dCurr = [];
    const dNew = [];
    const dExtra = [];

    for (let m = 0; m <= maxMonths; m += step) {
      const yr = m / 12;
      labels.push(yr % 1 === 0 ? `Yr ${Math.round(yr)}` : '');
      dCurr.push(curr.schedule[Math.min(m, curr.schedule.length - 1)] ?? 0);
      dNew.push(newLoan.schedule[Math.min(m, newLoan.schedule.length - 1)] ?? 0);
      dExtra.push(extra.schedule[Math.min(m, extra.schedule.length - 1)] ?? 0);
    }

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickColor = isDark ? '#6b6a66' : '#9a9893';
    const cCurr = isDark ? '#6b6a66' : '#b0aead';
    const cNew = isDark ? '#2ecc82' : '#1a6b4a';
    const cExtra = isDark ? '#5ab4f0' : '#1a4a6b';

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Current',
              data: dCurr,
              borderColor: cCurr,
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.3,
              borderDash: [4, 3],
            },
            {
              label: 'New rate (min)',
              data: dNew,
              borderColor: cNew,
              backgroundColor: isDark ? 'rgba(46,204,130,0.06)' : 'rgba(26,107,74,0.06)',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: true,
            },
            {
              label: 'New rate + extra',
              data: dExtra,
              borderColor: cExtra,
              backgroundColor: isDark ? 'rgba(90,180,240,0.08)' : 'rgba(26,74,107,0.08)',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: true,
              borderDash: [2, 2],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ctx.dataset.label + ': $' + Math.round(ctx.raw).toLocaleString('en-NZ'),
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: tickColor,
                font: { size: 11, family: "'DM Mono', monospace" },
                maxRotation: 0,
                autoSkip: false,
              },
              grid: { color: gridColor },
            },
            y: {
              ticks: {
                color: tickColor,
                font: { size: 11, family: "'DM Mono', monospace" },
                callback: (v) => '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v),
              },
              grid: { color: gridColor },
            },
          },
        },
      });
    }
  }, [balance, currentRate, currentPayment, newRate, extraMonthly, extraLumpSum, lumpSumMonth]);

  if (!calculations) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <header>
        <p className="eyebrow">NZ Mortgage Tool</p>
        <h1>
          Refix <span>rate calculator</span>
        </h1>
        <p className="subtitle">Compare your current rate, new minimum payment, and the impact of paying extra each month.</p>
      </header>

      {/* Current loan inputs */}
      <div className="card">
        <p className="card-title">Your loan details</p>
        <div className="fields">
          <div className="field">
            <label htmlFor="balance">Remaining balance</label>
            <div className="input-wrap has-prefix">
              <span className="input-prefix">$</span>
              <input
                type="number"
                id="balance"
                value={balance}
                onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                step="1000"
                min="1000"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="currentPayment">Current monthly payment</label>
            <div className="input-wrap has-prefix">
              <span className="input-prefix">$</span>
              <input
                type="number"
                id="currentPayment"
                value={currentPayment}
                onChange={(e) => setCurrentPayment(parseFloat(e.target.value) || 0)}
                step="1"
                min="100"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="currentRate">Current rate</label>
            <div className="input-wrap has-suffix">
              <input
                type="number"
                id="currentRate"
                value={currentRate}
                onChange={(e) => setCurrentRate(parseFloat(e.target.value) || 0)}
                step="0.01"
                min="0.1"
                max="30"
              />
              <span className="input-suffix">%</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="newRate">New rate — drag to adjust</label>
            <div className="input-wrap has-suffix" style={{ marginBottom: '6px' }}>
              <input
                type="number"
                id="newRate"
                value={newRate}
                onChange={(e) => setNewRate(parseFloat(e.target.value) || 0)}
                step="0.01"
                min="0.1"
                max="30"
              />
              <span className="input-suffix">%</span>
            </div>
            <div className="slider-row">
              <input
                type="range"
                id="newRateSlider"
                min="1"
                max="15"
                step="0.01"
                value={newRate}
                onChange={(e) => setNewRate(parseFloat(e.target.value))}
              />
              <span className="rate-display">{newRate.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Extra repayment inputs */}
      <div className="card extra-card">
        <p className="card-title">Extra repayments (new rate)</p>
        <div className="fields-3">
          <div className="field">
            <label htmlFor="extraMonthly">Extra per month</label>
            <div className="input-wrap has-prefix">
              <span className="input-prefix">$</span>
              <input
                type="number"
                id="extraMonthly"
                value={extraMonthly}
                onChange={(e) => setExtraMonthly(Math.max(0, parseFloat(e.target.value) || 0))}
                step="50"
                min="0"
              />
            </div>
            <p className="hint">Added on top of the minimum payment each month</p>
          </div>
          <div className="field">
            <label htmlFor="extraLumpSum">One-off lump sum</label>
            <div className="input-wrap has-prefix">
              <span className="input-prefix">$</span>
              <input
                type="number"
                id="extraLumpSum"
                value={extraLumpSum}
                onChange={(e) => setExtraLumpSum(Math.max(0, parseFloat(e.target.value) || 0))}
                step="1000"
                min="0"
              />
            </div>
            <p className="hint">Applied at the start of the new term</p>
          </div>
          <div className="field">
            <label htmlFor="lumpSumMonth">Lump sum at month #</label>
            <div className="input-wrap">
              <input
                type="number"
                id="lumpSumMonth"
                value={lumpSumMonth}
                onChange={(e) => setLumpSumMonth(Math.max(1, parseInt(e.target.value) || 1))}
                step="1"
                min="1"
                max="360"
              />
            </div>
            <p className="hint">Month 1 = immediately on refix</p>
          </div>
        </div>
      </div>

      {/* Saving banner */}
      <div className="saving-banner">
        <div className="saving-item">
          <p className="saving-label">Min payment saving</p>
          <p className="saving-val">
            {calculations.monthlySaving >= 0 ? '+' : ''}
            {fmtDec(calculations.monthlySaving)}/mo
          </p>
        </div>
        <div className="saving-item">
          <p className="saving-label">Interest saving (min)</p>
          <p className="saving-val">{fmt(calculations.totalSaving)}</p>
        </div>
        <div className="saving-item">
          <p className="saving-label">Time saved w/ extra</p>
          <p className="saving-val">{calculations.monthsSaved > 0 ? termStr(calculations.monthsSaved) : '—'}</p>
        </div>
        <div className="saving-item">
          <p className="saving-label">Interest saved w/ extra</p>
          <p className="saving-val">{calculations.interestSavedExtra > 0 ? fmt(calculations.interestSavedExtra) : '—'}</p>
        </div>
      </div>

      {/* Results: 3 columns */}
      <div className="results-grid">
        {/* Current */}
        <div className="result-card">
          <div className="result-card-header">
            <span className="result-card-label">Current</span>
            <span className="badge badge-gray">{currentRate.toFixed(2)}%</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Loan term</span>
            <span className="metric-val">{calculations.currTerm}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Monthly payment</span>
            <span className="metric-val">{fmtDec(calculations.currPayment)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total interest</span>
            <span className="metric-val">{fmt(calculations.currInterest)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total repaid</span>
            <span className="metric-val">{fmt(calculations.currTotal)}</span>
          </div>
        </div>

        {/* New rate, min payment */}
        <div className="result-card highlight-green">
          <div className="result-card-header">
            <span className="result-card-label">New rate</span>
            <span className="badge badge-green">{newRate.toFixed(2)}%</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Loan term</span>
            <span className="metric-val good">{calculations.newTerm}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Min. monthly payment</span>
            <span className="metric-val good">{fmtDec(calculations.newPayment)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total interest</span>
            <span className="metric-val good">{fmt(calculations.newInterest)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total repaid</span>
            <span className="metric-val good">{fmt(calculations.newTotal)}</span>
          </div>
        </div>

        {/* New rate + extra */}
        <div className="result-card highlight-blue">
          <div className="result-card-header">
            <span className="result-card-label">With extra</span>
            <span className="badge badge-blue">
              {extraMonthly > 0 ? `+${fmt(extraMonthly)}/mo` : extraLumpSum > 0 ? `${fmt(extraLumpSum)} lump` : 'no extra'}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Loan term</span>
            <span className="metric-val extra">{calculations.extraTerm}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total monthly payment</span>
            <span className="metric-val extra">{fmtDec(calculations.extraPayment)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total interest</span>
            <span className="metric-val extra">{fmt(calculations.extraInterest)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total repaid</span>
            <span className="metric-val extra">{fmt(calculations.extraTotal)}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-card">
        <p className="card-title">Balance over time</p>
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: 'var(--chart-curr)' }}></span>
            <span>Current {currentRate.toFixed(2)}%</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: 'var(--chart-new)' }}></span>
            <span>New {newRate.toFixed(2)}% (min)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: 'var(--extra)' }}></span>
            <span>New {newRate.toFixed(2)}% + extra</span>
          </div>
        </div>
        <div className="chart-wrap">
          <canvas
            ref={chartRef}
            role="img"
            aria-label="Remaining balance over time for current rate, new minimum payment, and new rate with extra repayments"
          ></canvas>
        </div>
      </div>

      <footer>
        <p>Indicative only. Assumes constant interest rate for the full term. Does not account for break fees, refix costs, or rate changes. Consult your bank or a mortgage adviser before making decisions.</p>
      </footer>
    </div>
  );
}

export default App;
