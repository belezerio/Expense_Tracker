import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

// ─── constants ────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmt     = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
const fmtFull = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

// ─── data fetching ────────────────────────────────────────────
async function fetchAnalyticsData(userId) {
  const now = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // All transactions (last 24 months to be safe)
  const { data: txns, error } = await supabase
    .from('transactions')
    .select('id, title, total_amount, my_amount, category, date, month, year, emi_id')
    .eq('user_id', userId)
    .gte('year', currentYear - 1)
    .order('date', { ascending: false })

  if (error || !txns || txns.length === 0) return { months: [], tags: [], txns: [] }

  const ids = txns.map(t => t.id)

  // Tags for those transactions
  let tagMap = {}
  try {
    const { data: ttRows } = await supabase
      .from('transaction_tags')
      .select('transaction_id, tags( id, name, color )')
      .in('transaction_id', ids)
    ;(ttRows ?? []).forEach(row => {
      if (!tagMap[row.transaction_id]) tagMap[row.transaction_id] = []
      if (row.tags) tagMap[row.transaction_id].push(row.tags)
    })
  } catch (_) {}

  // ── Fetch debts to know which transactions have unsettled splits ──
  // debtMap[transaction_id] = { hasUnsettled: bool, unsettledAmount: number }
  let debtMap = {}
  try {
    const { data: debtRows } = await supabase
      .from('debts')
      .select('transaction_id, amount, is_settled')
      .eq('user_id', userId)
      .in('transaction_id', ids)

    ;(debtRows ?? []).forEach(d => {
      if (!debtMap[d.transaction_id]) {
        debtMap[d.transaction_id] = { hasUnsettled: false, unsettledAmount: 0 }
      }
      if (!d.is_settled) {
        debtMap[d.transaction_id].hasUnsettled = true
        debtMap[d.transaction_id].unsettledAmount += Number(d.amount)
      }
    })
  } catch (_) {}

  // Budgets
  const { data: budgets } = await supabase
    .from('budgets')
    .select('month, year, amount')
    .eq('user_id', userId)
    .gte('year', currentYear - 1)
  const budgetMap = {}
  ;(budgets ?? []).forEach(b => { budgetMap[`${b.year}-${b.month}`] = Number(b.amount) })

  const enriched = txns.map(t => ({
    ...t,
    txn_tags: tagMap[t.id] ?? [],
    debtInfo: debtMap[t.id] ?? { hasUnsettled: false, unsettledAmount: 0 },
  }))

  // ── spendOf: use total_amount when there are unsettled debts (you fronted
  //    the full amount and haven't been paid back yet), otherwise my_amount
  const spendOf = (t) => {
    if (Number(t.my_amount) < 0) return Number(t.my_amount) // credit/collection — keep as-is
    if (t.debtInfo?.hasUnsettled) return Number(t.total_amount)
    return Number(t.my_amount)
  }

  // Group by month
  const monthMap = {}
  enriched.forEach(t => {
    const key = `${t.year}-${String(t.month).padStart(2, '0')}`
    if (!monthMap[key]) monthMap[key] = {
      year: t.year, month: t.month, txns: [], total: 0,
      budget: budgetMap[`${t.year}-${t.month}`] || 0
    }
    monthMap[key].txns.push(t)
    const spend = spendOf(t)
    if (spend > 0) {
      monthMap[key].total += spend
    }
  })

  const months = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({ key, ...val }))

  // All unique tags
  const tagSet = {}
  enriched.forEach(t => t.txn_tags.forEach(tag => { tagSet[tag.id] = tag }))
  const tags = Object.values(tagSet)

  return { months, tags, txns: enriched, spendOf }
}

// ─── SVG Donut ───────────────────────────────────────────────
function DonutChart({ segments, size = 120, thickness = 22, label }) {
  const r    = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const cx   = size / 2, cy = size / 2
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  let cum = 0

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        ) : segments.map((seg, i) => {
          const pct    = seg.value / total
          const dash   = pct * circ
          const offset = circ - cum * circ
          cum += pct
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dasharray 0.8s ease', transformOrigin: 'center', transform: 'rotate(-90deg)' }}
            />
          )
        })}
        <circle cx={cx} cy={cy} r={r - thickness / 2 - 2} fill="#111118" />
      </svg>
      {label && (
        <div className="absolute text-center pointer-events-none">
          <p className="text-[10px] text-white/30 leading-tight">{label.sub}</p>
          <p className="text-sm font-bold text-white leading-tight">{label.main}</p>
        </div>
      )}
    </div>
  )
}

// ─── Horizontal bar ──────────────────────────────────────────
function HBar({ label, value, max, color, dot, pctOverride }) {
  const pct = pctOverride ?? (max > 0 ? Math.min((value / max) * 100, 100) : 0)
  return (
    <div className="flex items-center gap-3">
      {dot
        ? <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        : <div className="w-5 text-xs text-white/25 shrink-0 text-center">#</div>
      }
      <div className="w-24 text-xs text-white/50 truncate shrink-0">{label}</div>
      <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-xs font-medium text-white/70 w-16 text-right shrink-0">{fmtFull(value)}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════
export default function Analytics() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [view,          setView]          = useState('overview') // 'overview' | 'month'
  const [activeTag,     setActiveTag]     = useState(null)

  useEffect(() => {
    if (!user) return
    fetchAnalyticsData(user.id).then(d => {
      setData(d)
      if (d.months.length > 0) setSelectedMonth(d.months[d.months.length - 1].key)
      setLoading(false)
    })
  }, [user])

  const currentMonthData = data?.months.find(m => m.key === selectedMonth)
  const spendOf = data?.spendOf ?? ((t) => Number(t.my_amount))

  // ── tag breakdown for a set of transactions ───────────────
  const buildTagBreakdown = (txns) => {
    const map = {}
    txns.forEach(t => {
      const spend = spendOf(t)
      if (spend <= 0) return           // skip credits and zero-amount entries
      t.txn_tags.forEach(tag => {
        if (!map[tag.id]) map[tag.id] = { tag, val: 0, count: 0 }
        map[tag.id].val   += spend
        map[tag.id].count++
      })
    })
    return Object.values(map).sort((a, b) => b.val - a.val)
  }

  // ── monthly tag breakdown ─────────────────────────────────
  const monthTagBreakdown = currentMonthData ? buildTagBreakdown(currentMonthData.txns) : []

  // ── day-of-month spend ────────────────────────────────────
  const dayBreakdown = (() => {
    if (!currentMonthData) return {}
    const map = {}
    currentMonthData.txns.forEach(t => {
      const spend = spendOf(t)
      if (spend <= 0) return
      const day = new Date(t.date).getDate()
      map[day] = (map[day] || 0) + spend
    })
    return map
  })()
  const maxDay = Math.max(...Object.values(dayBreakdown), 1)

  // ── overall stats ─────────────────────────────────────────
  const allTimeTxns  = data?.txns.filter(t => spendOf(t) > 0) ?? []
  const allTimeSpend = allTimeTxns.reduce((s, t) => s + spendOf(t), 0)
  const avgMonthly   = data?.months.length ? data.months.reduce((s, m) => s + Math.max(m.total, 0), 0) / data.months.length : 0
  const maxMonthTotal = Math.max(...(data?.months.map(m => Math.max(m.total, 0)) ?? [0]), 1)

  // top tag all time
  const allTimeTagBreakdown = data ? buildTagBreakdown(data.txns) : []

  // filtered txns for month view
  const filteredTxns = (() => {
    if (!currentMonthData) return []
    const txns = currentMonthData.txns
    if (!activeTag) return txns
    return txns.filter(t => t.txn_tags.some(tg => tg.id === activeTag))
  })()

  const daysInMonth = currentMonthData
    ? new Date(currentMonthData.year, currentMonthData.month, 0).getDate()
    : 31

  // ── Loading / empty ───────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  )

  if (!data || data.months.length === 0) return (
    <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center text-center px-4">
      <p className="text-4xl mb-4">📊</p>
      <p className="text-white/40 mb-1">No transaction data yet.</p>
      <p className="text-white/20 text-sm mb-4">Add some expenses on the dashboard first.</p>
      <button onClick={() => navigate('/dashboard')} className="text-sm text-emerald-400 hover:underline">← Back to Dashboard</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#09090f] text-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 border-b border-white/6 bg-[#09090f]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-sm"
          >
            ← <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-400 rounded-lg flex items-center justify-center text-[#09090f] font-bold text-xs">📊</div>
            <span className="font-semibold tracking-tight">Analytics</span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1">
          {[
            { key: 'overview', label: '📈 Overview' },
            { key: 'month',    label: '🗓 Monthly'  },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${view === v.key ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-7 space-y-6">

        {/* ══════════════ OVERVIEW ══════════════ */}
        {view === 'overview' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Total Spent',
                  val:   fmt(allTimeSpend),
                  sub:   `${allTimeTxns.length} transactions`,
                  color: 'text-white',
                  border:'border-white/10',
                },
                {
                  label: 'Monthly Avg',
                  val:   fmt(avgMonthly),
                  sub:   `over ${data.months.length} month${data.months.length !== 1 ? 's' : ''}`,
                  color: 'text-emerald-300',
                  border:'border-emerald-400/20',
                },
                {
                  label: 'Top Tag',
                  val:   allTimeTagBreakdown[0]?.tag.name ?? '—',
                  sub:   allTimeTagBreakdown[0] ? fmt(allTimeTagBreakdown[0].val) : 'No tags yet',
                  color: 'text-violet-300',
                  border:'border-violet-400/20',
                  dot:   allTimeTagBreakdown[0]?.tag.color,
                },
                {
                  label: 'Highest Month',
                  val: (() => {
                    const m = data.months.reduce((a, b) => b.total > a.total ? b : a, data.months[0])
                    return `${MONTHS[m.month - 1]} ${m.year}`
                  })(),
                  sub:   fmt(Math.max(...data.months.map(m => m.total))),
                  color: 'text-amber-300',
                  border:'border-amber-400/20',
                },
              ].map(({ label, val, sub, color, border, dot }) => (
                <div key={label} className={`bg-white/[0.025] border ${border} rounded-2xl p-4`}>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
                  <div className="flex items-center gap-1.5">
                    {dot && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />}
                    <p className={`text-xl font-bold ${color} truncate`}>{val}</p>
                  </div>
                  {sub && <p className="text-xs text-white/25 mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>

            {/* Monthly bar chart */}
            <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-1">Monthly Spend Trend</h3>
              <p className="text-xs text-white/30 mb-5">Click a bar to explore that month in detail</p>
              <div className="flex items-end gap-1.5" style={{ height: 120 }}>
                {data.months.map(m => {
                  const spend      = Math.max(m.total, 0)
                  const pct        = (spend / maxMonthTotal) * 100
                  const isSelected = m.key === selectedMonth
                  const overBudget = m.budget > 0 && spend > m.budget
                  const budgetPct  = m.budget > 0 ? Math.min((m.budget / maxMonthTotal) * 100, 100) : null
                  return (
                    <button
                      key={m.key}
                      onClick={() => { setSelectedMonth(m.key); setView('month') }}
                      className="flex-1 flex flex-col items-center gap-1 group relative"
                      style={{ height: 120 }}
                    >
                      {/* budget line */}
                      {budgetPct !== null && (
                        <div
                          className="absolute w-full border-t border-dashed border-white/20 pointer-events-none"
                          style={{ bottom: `${budgetPct + 14}%` }}
                        />
                      )}
                      <div className="w-full flex flex-col justify-end flex-1">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${isSelected ? 'opacity-100' : 'opacity-45 group-hover:opacity-70'}`}
                          style={{
                            height: spend > 0 ? `${Math.max(pct, 2)}%` : 2,
                            background: overBudget
                              ? 'linear-gradient(to top,#ef4444,#f87171)'
                              : isSelected
                                ? 'linear-gradient(to top,#a78bfa,#c4b5fd)'
                                : 'linear-gradient(to top,#6366f1,#818cf8)',
                          }}
                        />
                      </div>
                      <span className={`text-[9px] leading-none transition-colors ${isSelected ? 'text-white' : 'text-white/30 group-hover:text-white/60'}`}>
                        {MONTHS[m.month - 1]}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-white/20">
                <span>₹0</span>
                <span>{fmt(maxMonthTotal / 2)}</span>
                <span>{fmt(maxMonthTotal)}</span>
              </div>
            </div>

            {/* All-time tag breakdown */}
            {allTimeTagBreakdown.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tag bars */}
                  <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold mb-4">Spend by Tag — All Time</h3>
                    <div className="space-y-2.5">
                      {allTimeTagBreakdown.map(({ tag, val }) => (
                        <HBar
                          key={tag.id}
                          label={tag.name}
                          value={val}
                          max={allTimeTagBreakdown[0].val}
                          color={tag.color}
                          dot
                        />
                      ))}
                    </div>
                  </div>

                  {/* Tag donut */}
                  <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold mb-4">Tag Distribution</h3>
                    <div className="flex items-center gap-5">
                      <DonutChart
                        segments={allTimeTagBreakdown.map(({ tag, val }) => ({ color: tag.color, value: val }))}
                        size={120}
                        thickness={22}
                      />
                      <div className="flex-1 space-y-2">
                        {allTimeTagBreakdown.slice(0, 7).map(({ tag, val }) => {
                          const total = allTimeTagBreakdown.reduce((s, x) => s + x.val, 0)
                          return (
                            <div key={tag.id} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                              <span className="text-xs text-white/50 flex-1 truncate">{tag.name}</span>
                              <span className="text-xs font-medium" style={{ color: tag.color }}>
                                {total > 0 ? ((val / total) * 100).toFixed(0) : 0}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tag × month grid */}
                <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold mb-1">Tag Spend per Month</h3>
                  <p className="text-xs text-white/30 mb-4">How much you spent on each tag every month</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <td className="text-white/25 pr-4 pb-2 whitespace-nowrap">Tag</td>
                          {data.months.map(m => (
                            <td key={m.key} className="text-white/25 pb-2 text-center whitespace-nowrap px-1">
                              {MONTHS[m.month - 1]}
                            </td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allTimeTagBreakdown.slice(0, 8).map(({ tag }) => {
                          return (
                            <tr key={tag.id}>
                              <td className="pr-4 py-1.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                                  <span style={{ color: tag.color }} className="font-medium">{tag.name}</span>
                                </div>
                              </td>
                              {data.months.map(m => {
                                const monthTotal = buildTagBreakdown(m.txns).find(x => x.tag.id === tag.id)?.val ?? 0
                                const allForTag  = allTimeTagBreakdown.find(x => x.tag.id === tag.id)?.val ?? 1
                                const intensity  = allForTag > 0 ? monthTotal / allForTag : 0
                                return (
                                  <td key={m.key} className="text-center px-1 py-1.5">
                                    {monthTotal > 0 ? (
                                      <div
                                        className="mx-auto rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
                                        style={{
                                          background: tag.color + Math.round(intensity * 40 + 15).toString(16).padStart(2,'0'),
                                          color: tag.color,
                                        }}
                                      >
                                        {fmt(monthTotal)}
                                      </div>
                                    ) : (
                                      <span className="text-white/10">—</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-8 text-center">
                <p className="text-2xl mb-2">🏷</p>
                <p className="text-white/40 text-sm">No tags yet — add tags to your expenses to see a breakdown here.</p>
              </div>
            )}
          </>
        )}

        {/* ══════════════ MONTHLY ══════════════ */}
        {view === 'month' && (
          <>
            {/* Month selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {data.months.map(m => (
                <button
                  key={m.key}
                  onClick={() => { setSelectedMonth(m.key); setActiveTag(null) }}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    m.key === selectedMonth
                      ? 'bg-violet-400/20 text-violet-300 border-violet-400/30'
                      : 'bg-white/5 text-white/35 border-white/8 hover:text-white/60'
                  }`}
                >
                  {MONTHS[m.month - 1]} {m.year}
                </button>
              ))}
            </div>

            {currentMonthData && (
              <>
                {/* Month header */}
                <div className="bg-gradient-to-br from-violet-950/40 to-[#111118] border border-violet-500/15 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">
                        {MONTHS[currentMonthData.month - 1]} {currentMonthData.year}
                      </p>
                      <p className="text-3xl font-bold">{fmtFull(Math.max(currentMonthData.total, 0))}</p>
                      {/* Pending debt note */}
                      {(() => {
                        const pendingAmt = currentMonthData.txns.reduce((s, t) => {
                          return s + (t.debtInfo?.hasUnsettled ? t.debtInfo.unsettledAmount : 0)
                        }, 0)
                        if (pendingAmt <= 0) return null
                        return (
                          <p className="text-xs mt-1 text-amber-300/80">
                            💳 Includes {fmtFull(pendingAmt)} pending from friends
                          </p>
                        )
                      })()}
                      {currentMonthData.budget > 0 && (
                        <p className={`text-xs mt-1 ${currentMonthData.total > currentMonthData.budget ? 'text-red-400' : 'text-emerald-400'}`}>
                          {currentMonthData.total > currentMonthData.budget
                            ? `⚠ Over budget by ${fmtFull(currentMonthData.total - currentMonthData.budget)}`
                            : `✓ ${fmtFull(currentMonthData.budget - currentMonthData.total)} under budget`}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/30 mb-0.5">{currentMonthData.txns.length} transactions</p>
                      {currentMonthData.budget > 0 && (
                        <>
                          <p className="text-xs text-white/25">Budget: {fmt(currentMonthData.budget)}</p>
                          <div className="mt-2 w-28 h-1.5 bg-white/8 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${currentMonthData.total > currentMonthData.budget ? 'bg-red-400' : 'bg-violet-400'}`}
                              style={{ width: `${Math.min((currentMonthData.total / currentMonthData.budget) * 100, 100)}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Daily spend heatmap */}
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Daily spend</p>
                    <div className="flex gap-px items-end" style={{ height: 36 }}>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1
                        const val = dayBreakdown[day] || 0
                        const pct = maxDay > 0 ? (val / maxDay) * 100 : 0
                        return (
                          <div key={day} className="flex-1 flex flex-col justify-end group relative" style={{ height: 36 }}>
                            <div
                              className="w-full rounded-t-[1px]"
                              style={{
                                height: val > 0 ? `${Math.max(pct, 8)}%` : 0,
                                background: `rgba(167,139,250,${0.25 + (pct / 100) * 0.75})`,
                                minHeight: val > 0 ? 2 : 0,
                              }}
                            />
                            {val > 0 && (
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1a1a2e] border border-white/15 rounded-lg px-2 py-1 text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {day} — {fmt(val)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-white/20 mt-1">
                      <span>1</span>
                      <span>{Math.ceil(daysInMonth / 2)}</span>
                      <span>{daysInMonth}</span>
                    </div>
                  </div>
                </div>

                {/* Tag breakdown for this month */}
                {monthTagBreakdown.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tag bars */}
                    <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Spend by Tag</h3>
                        {activeTag && (
                          <button onClick={() => setActiveTag(null)} className="text-xs text-violet-300/60 hover:text-violet-300 transition-colors">✕ Clear</button>
                        )}
                      </div>
                      {/* Clickable tag chips */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {monthTagBreakdown.map(({ tag, val, count }) => (
                          <button
                            key={tag.id}
                            onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                              activeTag === tag.id ? 'opacity-100 scale-105' : 'opacity-55 hover:opacity-80'
                            }`}
                            style={{ background: tag.color + '15', borderColor: tag.color + '35', color: tag.color }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: tag.color }} />
                            {tag.name}
                            <span className="opacity-50">· {count}</span>
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2.5">
                        {monthTagBreakdown.map(({ tag, val }) => (
                          <HBar key={tag.id} label={tag.name} value={val} max={monthTagBreakdown[0].val} color={tag.color} dot />
                        ))}
                      </div>
                    </div>

                    {/* Tag donut */}
                    <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-5">
                      <h3 className="text-sm font-semibold mb-4">Tag Distribution</h3>
                      <div className="flex flex-col items-center gap-4">
                        <DonutChart
                          segments={monthTagBreakdown.map(({ tag, val }) => ({ color: tag.color, value: val }))}
                          size={130}
                          thickness={24}
                        />
                        <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {monthTagBreakdown.map(({ tag, val }) => {
                            const total = monthTagBreakdown.reduce((s, x) => s + x.val, 0)
                            return (
                              <div key={tag.id} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                                <span className="text-[11px] text-white/40 flex-1 truncate">{tag.name}</span>
                                <span className="text-[11px] font-medium" style={{ color: tag.color }}>
                                  {total > 0 ? ((val / total) * 100).toFixed(0) : 0}%
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-6 text-center">
                    <p className="text-xl mb-2">🏷</p>
                    <p className="text-white/30 text-sm">No tags used this month</p>
                  </div>
                )}

                {/* Transaction list — filtered by active tag */}
                <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">
                      Transactions
                      <span className="ml-2 text-xs text-white/25 font-normal">{filteredTxns.length} shown</span>
                    </h3>
                    {activeTag && (
                      <button onClick={() => setActiveTag(null)} className="text-xs text-violet-300/60 hover:text-violet-300 transition-colors">✕ Clear filter</button>
                    )}
                  </div>
                  {filteredTxns.length === 0 ? (
                    <p className="text-white/20 text-sm text-center py-6">No transactions match this filter</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {filteredTxns.map(t => {
                        const isCredit = Number(t.my_amount) < 0
                        const hasUnsettledDebt = t.debtInfo?.hasUnsettled
                        const displayAmt = isCredit
                          ? Math.abs(Number(t.my_amount))
                          : spendOf(t)
                        return (
                          <div
                            key={t.id}
                            className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 transition-all ${
                              isCredit
                                ? 'bg-emerald-400/[0.04] border-emerald-400/15'
                                : hasUnsettledDebt
                                  ? 'bg-amber-400/[0.03] border-amber-400/15'
                                  : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/5'
                            }`}
                          >
                            <div className="text-base shrink-0">
                              {isCredit ? '💰' : t.emi_id ? '📋' : '💸'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{t.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-white/25">
                                  {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                                {hasUnsettledDebt && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                                    style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.25)' }}>
                                    💳 {fmtFull(t.debtInfo.unsettledAmount)} pending
                                  </span>
                                )}
                                {t.txn_tags.map(tag => (
                                  <span
                                    key={tag.id}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                                    style={{ background: tag.color + '15', color: tag.color, borderColor: tag.color + '30' }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-semibold ${isCredit ? 'text-emerald-400' : hasUnsettledDebt ? 'text-white' : ''}`}>
                                {isCredit ? '+' : ''}{fmtFull(displayAmt)}
                              </p>
                              {hasUnsettledDebt && (
                                <p className="text-[10px] text-white/25">
                                  my share: {fmtFull(Number(t.my_amount))}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

      </main>
    </div>
  )
}