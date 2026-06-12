import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './App.css';

function App() {
  const [balance, setBalance] = useState(337000);
  const [currentRate, setCurrentRate] = useState(5.99);
  const [currentPayment, setCurrentPayment] = useState(2413.14);
  const [newRate, setNewRate] = useState(5.19);
  const [calculations, setCalculations] = useState(null);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Utilities
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-NZ');
  const fmtDec = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Calculation functions
  const calcLoan = (balance, annualRate, monthlyPayment) => {
    const r = annualRate / 100 / 12;
    if (r <= 0 || monthlyPayment <= 0) return null;
    const num = monthlyPayment - r * balance;
    if (num <= 0) return null;
    const months = Math.ceil(-Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r));
    if (!isFinite(months) || months <= 0 || months > 1200) return null;
    let bal = balance;
    let totalInterest = 0;
    const schedule = [{ m: 0, bal: balance }];
    for (let i = 0; i < months; i++) {
      const interest = bal * r;
      totalInterest += interest;
      bal = Math.max(0, bal + interest - monthlyPayment);
      schedule.push({ m: i + 1, bal });
    }
    return { months, totalInterest, schedule };
  };

  const calcPayment = (balance, annualRate, months) => {
    const r = annualRate / 100 / 12;
    if (r === 0) return balance / months;
    return (balance * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  };

  // Main render logic
  useEffect(() => {
    const curr = calcLoan(balance, currentRate, currentPayment);
    if (!curr) return;

    const newPmt = calcPayment(balance, newRate, curr.months);
    const newLoan = calcLoan(balance, newRate, newPmt);
    if (!newLoan) return;

    const yrs = Math.floor(curr.months / 12);
    const mos = curr.months % 12;
    const termStr = yrs + (mos > 0 ? ` yr ${mos} mo` : ' yr');

    const monthlySaving = currentPayment - newPmt;
    const totalSaving = curr.totalInterest - newLoan.totalInterest;

    setCalculations({
      currTerm: termStr,
      currPayment,
      currInterest: curr.totalInterest,
      currTotal: balance + curr.totalInterest,
      newTerm: termStr,
      newPayment: newPmt,
      newInterest: newLoan.totalInterest,
      newTotal: balance + newLoan.totalInterest,
      monthlySaving,
      totalSaving,
      currSchedule: curr.schedule,
      newSchedule: newLoan.schedule,
      currMonths: curr.months,
      newMonths: newLoan.months,
    });

    // Update chart
    const step = Math.max(1, Math.floor(curr.months / 80));
    const labels = [];
    const dCurr = [];
    const dNew = [];

    for (let m = 0; m <= curr.months; m += step) {
      const yr = m / 12;
      labels.push(yr % 1 === 0 ? `Yr ${yr}` : '');
      dCurr.push(curr.schedule[Math.min(m, curr.schedule.length - 1)]?.bal ?? 0);
      dNew.push(newLoan.schedule[Math.min(m, newLoan.schedule.length - 1)]?.bal ?? 0);
    }

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickColor = isDark ? '#6b6a66' : '#9a9893';
    const currColor = isDark ? '#6b6a66' : '#b0aead';
    const newColor = isDark ? '#2ecc82' : '#1a6b4a';

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
              borderColor: currColor,
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.3,
              borderDash: [4, 3],
            },
            {
              label: 'New rate',
              data: dNew,
              borderColor: newColor,
              backgroundColor: isDark ? 'rgba(46,204,130,0.08)' : 'rgba(26,107,74,0.08)',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
  }, [balance, currentRate, currentPayment, newRate]);

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
        <p className="subtitle">Compare your current fixed rate against a new one — same term, lower payment.</p>
      </header>

      {/* Inputs */}
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

      {/* Saving banner */}
      <div className="saving-banner">
        <div className="saving-item">
          <p className="saving-label">Monthly saving</p>
          <p className="saving-val">
            {calculations.monthlySaving >= 0 ? '+' : ''}
            {fmtDec(calculations.monthlySaving)}/mo
          </p>
        </div>
        <div className="saving-item">
          <p className="saving-label">Total interest saving</p>
          <p className="saving-val">{fmt(calculations.totalSaving)}</p>
        </div>
      </div>

      {/* Results */}
      <div className="results-grid">
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
        <div className="result-card highlight">
          <div className="result-card-header">
            <span className="result-card-label">New rate</span>
            <span className="badge badge-green">{newRate.toFixed(2)}%</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Loan term</span>
            <span className="metric-val">{calculations.newTerm}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Monthly payment</span>
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
            <span>New {newRate.toFixed(2)}%</span>
          </div>
        </div>
        <div className="chart-wrap">
          <canvas
            ref={chartRef}
            role="img"
            aria-label="Remaining balance over time for current vs new interest rate"
          ></canvas>
        </div>
      </div>

      <footer>
        <p>Indicative only. Assumes constant rate for the full term. Consult your bank or mortgage adviser before refixing.</p>
      </footer>
    </div>
  );
}

export default App;
