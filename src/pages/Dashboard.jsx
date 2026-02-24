import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getBudget, upsertBudget,
  getTags, createTag, deleteTag,
  getFriends, addFriend, deleteFriend, getFriendDebts,
  getTransactions, addTransaction, deleteTransaction,
  addDebts, getPendingDebts, settleDebt, settleAllFriendDebts,
  getWinnings, addWinning, deleteWinning,
  getEmis, addEmi, deleteEmi, payEmi, unpayEmi,
  currentMonth, currentYear,
} from '../lib/db'

// ─── constants ──────────────────────────────────────────────
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CATEGORIES = ['Food','Transport','Shopping','Entertainment','Health','Bills','Education','General']
const CAT_ICON = { Food:'🍕', Transport:'🚗', Shopping:'🛍', Entertainment:'🎬', Health:'💊', Bills:'💡', Education:'📚', General:'📦' }

const TAG_PALETTE = [
  '#6ee7b7','#67e8f9','#a78bfa','#f9a8d4','#fcd34d',
  '#86efac','#fb923c','#f87171','#60a5fa','#e879f9',
]

// ─── helpers ─────────────────────────────────────────────────
const tagStyle = (color) => ({
  background: color + '20',
  color: color,
  borderColor: color + '40',
})

// ─── tiny components ─────────────────────────────────────────
const Modal = ({ open, onClose, title, wide, children }) => {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-[#111118] border border-white/10 rounded-2xl w-full shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/35 hover:text-white text-2xl leading-none transition-colors">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

const iCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-emerald-400/50 focus:bg-emerald-400/[0.03] transition-all"
const sCls = "w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50 transition-all"
const lCls = "text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 block"

// ─── Tag Pill ─────────────────────────────────────────────────
const TagPill = ({ tag, onRemove, small }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border font-medium ${small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'}`}
    style={tagStyle(tag.color)}
  >
    {tag.name}
    {onRemove && (
      <button onClick={() => onRemove(tag.id)} className="hover:opacity-60 transition-opacity leading-none">×</button>
    )}
  </span>
)

// ─── Tag Selector (inline) ────────────────────────────────────
const TagSelector = ({ allTags, selectedIds, onChange, onCreateTag }) => {
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)

  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  const handleCreate = async () => {
    if (!newTagName.trim()) return
    setLoading(true)
    const tag = await onCreateTag(newTagName.trim(), newTagColor)
    if (tag) {
      onChange([...selectedIds, tag.id])
      setNewTagName('')
      setCreating(false)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {allTags.map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
              selectedIds.includes(tag.id) ? 'opacity-100 scale-105' : 'opacity-40 hover:opacity-70'
            }`}
            style={tagStyle(tag.color)}
          >
            {selectedIds.includes(tag.id) && <span>✓</span>}
            {tag.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCreating(v => !v)}
          className="text-xs px-2.5 py-1 rounded-full border border-dashed border-white/20 text-white/35 hover:text-white/60 hover:border-white/40 transition-all"
        >
          {creating ? '✕ cancel' : '+ new tag'}
        </button>
      </div>

      {creating && (
        <div className="flex gap-2 items-center bg-white/[0.03] rounded-xl p-3 border border-white/8">
          <input
            className={`${iCls} flex-1`}
            placeholder="Tag name"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex gap-1 shrink-0">
            {TAG_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewTagColor(c)}
                className={`w-5 h-5 rounded-full transition-all ${newTagColor === c ? 'scale-125 ring-2 ring-white/40' : 'opacity-60 hover:opacity-100'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={loading || !newTagName.trim()}
            className="shrink-0 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-[#09090f] font-semibold text-xs px-3 py-2 rounded-lg transition-all"
          >
            {loading ? '...' : 'Add'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Friend Debt Detail Modal ─────────────────────────────────
const FriendDetailModal = ({ friend, open, onClose, onSettle, onSettleAll, userId }) => {
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(false)
  const [settlingAll, setSettlingAll] = useState(false)

  useEffect(() => {
    if (!open || !friend) return
    setLoading(true)
    getFriendDebts(userId, friend.id).then(({ data }) => {
      setDebts(data); setLoading(false)
    })
  }, [open, friend, userId])

  const pending  = debts.filter(d => !d.is_settled)
  const settled  = debts.filter(d => d.is_settled)
  const totalOwed = pending.reduce((s, d) => s + Number(d.amount), 0)

  const handleSettleAll = async () => {
    if (!window.confirm(`Mark all ${pending.length} debts from ${friend.name} as collected? (${fmt(totalOwed)} total)`)) return
    setSettlingAll(true)
    await onSettleAll(friend.id)
    setDebts(prev => prev.map(d => d.is_settled ? d : { ...d, is_settled: true, settled_at: new Date().toISOString() }))
    setSettlingAll(false)
  }

  if (!friend) return null

  return (
    <Modal open={open} onClose={onClose} title={`${friend.name}'s Debts`} wide>
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between bg-amber-400/8 border border-amber-400/15 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs text-white/40 mb-0.5">Currently owes you</p>
                <p className="text-xl font-bold text-amber-300">{fmt(totalOwed)}</p>
                <p className="text-xs text-white/30 mt-0.5">{pending.length} pending · {settled.length} settled</p>
              </div>
              {pending.length > 1 && (
                <button
                  onClick={handleSettleAll}
                  disabled={settlingAll}
                  className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-[#09090f] font-semibold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95"
                >
                  {settlingAll
                    ? <span className="w-4 h-4 border-2 border-[#09090f]/30 border-t-[#09090f] rounded-full animate-spin" />
                    : '✓✓'}
                  Collect All ({fmt(totalOwed)})
                </button>
              )}
              {pending.length === 1 && (
                <div className="text-right text-xs text-white/25">
                  Use ✓ Collected<br />below to settle
                </div>
              )}
            </div>

            {/* Pending debts */}
            {pending.length > 0 && (
              <div>
                <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Pending</p>
                <div className="space-y-2">
                  {pending.map(d => {
                    const txn = d.transactions
                    const tags = d.txn_tags || []
                    return (
                      <div key={d.id} className="bg-white/[0.03] border border-white/7 rounded-xl px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{txn?.title}</p>
                            <p className="text-xs text-white/35 mt-0.5">
                              {txn?.date && new Date(txn.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                              {txn?.note && <> · <span className="italic">{txn.note}</span></>}
                            </p>
                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {tags.map(t => <TagPill key={t.id} tag={t} small />)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold text-amber-300">{fmt(d.amount)}</span>
                            <button
                              onClick={async () => { await onSettle(d.id); setDebts(prev => prev.map(x => x.id === d.id ? { ...x, is_settled: true, settled_at: new Date().toISOString() } : x)) }}
                              className="text-xs bg-emerald-400/15 hover:bg-emerald-400/25 text-emerald-400 border border-emerald-400/20 px-2.5 py-1.5 rounded-lg transition-all font-medium"
                            >
                              ✓ Collected
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Settled history */}
            {settled.length > 0 && (
              <div>
                <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-2">Settled History</p>
                <div className="space-y-1.5">
                  {settled.map(d => {
                    const txn = d.transactions
                    const tags = d.txn_tags || []
                    return (
                      <div key={d.id} className="flex items-start justify-between gap-2 bg-white/[0.015] rounded-xl px-4 py-2.5 opacity-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white line-through">{txn?.title}</p>
                          <p className="text-xs text-white/30">
                            {txn?.date && new Date(txn.date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                            {d.settled_at && <> · collected {new Date(d.settled_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</>}
                          </p>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.map(t => <TagPill key={t.id} tag={t} small />)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-sm text-white/50 line-through">{fmt(d.amount)}</span>
                          <span className="text-[10px] text-emerald-400/70 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">Settled</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {debts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">👍</p>
                <p className="text-white/30 text-sm">No debts with {friend.name} yet</p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const [budget, setBudget]       = useState(null)
  const [transactions, setTxns]   = useState([])
  const [friends, setFriends]     = useState([])
  const [tags, setTags]           = useState([])
  const [pendingDebts, setDebts]  = useState([])
  const [winnings, setWinnings]   = useState([])
  const [emis, setEmis]           = useState([])
  const [loading, setLoading]     = useState(true)

  // Modals
  const [showBudget, setShowBudget]       = useState(false)
  const [showTxn, setShowTxn]             = useState(false)
  const [showFriends, setShowFriends]     = useState(false)
  const [showAllDebts, setShowAllDebts]   = useState(false)
  const [showTagMgr, setShowTagMgr]       = useState(false)
  const [showWinnings, setShowWinnings]   = useState(false)
  const [showEmis, setShowEmis]           = useState(false)
  const [friendDetail, setFriendDetail]   = useState(null)

  // Budget form
  const [budgetInput, setBudgetInput] = useState('')

  // Transaction form
  const [txn, setTxn] = useState({
    title: '', totalAmount: '', myAmount: '', category: 'General', note: '',
    date: new Date().toISOString().slice(0, 10)
  })
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [splits, setSplits] = useState([])
  const [txnErr, setTxnErr] = useState('')
  const [txnLoading, setTxnLoading] = useState(false)

  // Friend form
  const [fname, setFname] = useState('')
  const [femail, setFemail] = useState('')
  const [fErr, setFErr] = useState('')

  // Winning form
  const [winTitle, setWinTitle] = useState('')
  const [winAmount, setWinAmount] = useState('')
  const [winErr, setWinErr] = useState('')

  // EMI form
  const [emiForm, setEmiForm] = useState({ title: '', amount: '', totalMonths: '' })
  const [emiErr, setEmiErr] = useState('')
  const [emiLoading, setEmiLoading] = useState('')

  // ── load ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [b, t, f, tg, d, w, e] = await Promise.all([
      getBudget(user.id), getTransactions(user.id),
      getFriends(user.id), getTags(user.id), getPendingDebts(user.id),
      getWinnings(user.id), getEmis(user.id),
    ])
    setBudget(b.data); setTxns(t.data); setFriends(f.data)
    setTags(tg.data); setDebts(d.data); setWinnings(w.data); setEmis(e.data)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ── computed ──────────────────────────────────────────────
  const budgetAmt    = budget ? Number(budget.amount) : 0
  const totalWinnings = winnings.reduce((s, w) => s + Number(w.amount), 0)
  const effectiveBudget = budgetAmt + totalWinnings

  // EMI payments this month
  const emiPaidThisMonth = emis.reduce((s, emi) => {
    const paid = (emi.emi_payments || []).find(p => p.month === currentMonth && p.year === currentYear)
    return s + (paid ? Number(paid.amount) : 0)
  }, 0)

  // totalSpent = actual cash paid out of pocket
  // credits (negative my_amount) reduce the figure; split txns use total_amount since you fronted the full bill
  const totalSpent = transactions.reduce((s, t) => {
    const myAmt    = Number(t.my_amount)
    const totalAmt = Number(t.total_amount)
    if (myAmt < 0) return s + myAmt   // credit (debt collected) reduces spent
    return s + totalAmt               // full amount physically paid; friends owe their share back
  }, 0)
  const pendingTotal = pendingDebts.reduce((s, d) => s + Number(d.amount), 0)
  const remaining    = effectiveBudget - totalSpent
  const afterDebts   = remaining + pendingTotal   // what remaining becomes once friends pay back
  const pct          = effectiveBudget > 0 ? Math.min((totalSpent / effectiveBudget) * 100, 100) : 0

  // EMI helpers
  const getEmiProgress = (emi) => {
    const payments = emi.emi_payments || []
    return payments.length
  }
  const isEmiPaidThisMonth = (emi) =>
    (emi.emi_payments || []).some(p => p.month === currentMonth && p.year === currentYear)

  // ── budget ────────────────────────────────────────────────
  const saveBudget = async () => {
    if (!budgetInput || isNaN(budgetInput)) return
    const { data } = await upsertBudget(user.id, parseFloat(budgetInput))
    if (data) { setBudget(data); setShowBudget(false); setBudgetInput('') }
  }

  // ── tags ──────────────────────────────────────────────────
  const handleCreateTag = async (name, color) => {
    const { data, error } = await createTag(user.id, name, color)
    if (!error && data) { setTags(prev => [...prev, data].sort((a,b)=>a.name.localeCompare(b.name))); return data }
    return null
  }
  const handleDeleteTag = async (id) => {
    await deleteTag(id)
    setTags(prev => prev.filter(t => t.id !== id))
  }

  // ── transaction ───────────────────────────────────────────
  const resetTxn = () => {
    setTxn({ title: '', totalAmount: '', myAmount: '', category: 'General', note: '', date: new Date().toISOString().slice(0, 10) })
    setSplits([]); setTxnErr(''); setSelectedTagIds([])
  }

  const recomputeMyShare = (total, currentSplits) => {
    const splitSum = currentSplits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0)
    return String(Math.max(0, (parseFloat(total) || 0) - splitSum))
  }

  const handleTotalChange = (val) => {
    setTxn(f => ({
      ...f,
      totalAmount: val,
      myAmount: recomputeMyShare(val, splits),
    }))
  }

  const addSplit = () => {
    const newSplits = [...splits, { friendId: '', amount: '' }]
    setSplits(newSplits)
  }

  const updateSplit = (i, key, val) => {
    const newSplits = splits.map((sp, idx) => idx === i ? { ...sp, [key]: val } : sp)
    setSplits(newSplits)
    if (key === 'amount') {
      setTxn(f => ({ ...f, myAmount: recomputeMyShare(f.totalAmount, newSplits) }))
    }
  }

  const removeSplit = (i) => {
    const newSplits = splits.filter((_, idx) => idx !== i)
    setSplits(newSplits)
    setTxn(f => ({ ...f, myAmount: recomputeMyShare(f.totalAmount, newSplits) }))
  }

  const saveTxn = async () => {
    setTxnErr('')
    const total = parseFloat(txn.totalAmount)
    const mine  = parseFloat(txn.myAmount)
    if (!txn.title.trim())         return setTxnErr('Title is required')
    if (isNaN(total) || total <= 0) return setTxnErr('Enter a valid total amount')
    if (isNaN(mine)  || mine < 0)  return setTxnErr('My share is invalid')
    if (mine > total)               return setTxnErr("Your share can't exceed total")
    const splitSum = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0)
    if (splits.length > 0 && Math.abs(splitSum + mine - total) > 0.01) {
      return setTxnErr(`Shares don't add up — ${fmt(mine)} + ${fmt(splitSum)} ≠ ${fmt(total)}`)
    }
    setTxnLoading(true)
    const { data: saved, error } = await addTransaction(
      user.id,
      { ...txn, totalAmount: total, myAmount: mine, month: currentMonth, year: currentYear },
      selectedTagIds
    )
    if (error) { setTxnErr(error.message); setTxnLoading(false); return }
    const debtRows = splits
      .filter(sp => sp.friendId && parseFloat(sp.amount) > 0)
      .map(sp => ({ user_id: user.id, transaction_id: saved.id, friend_id: sp.friendId, amount: parseFloat(sp.amount) }))
    if (debtRows.length) await addDebts(debtRows)
    setTxnLoading(false); setShowTxn(false); resetTxn(); load()
  }

  // ── friends ───────────────────────────────────────────────
  const saveFriend = async () => {
    setFErr('')
    if (!fname.trim()) return setFErr('Name is required')
    const { data, error } = await addFriend(user.id, fname.trim(), femail.trim())
    if (error) return setFErr(error.message)
    setFriends(f => [...f, data].sort((a,b)=>a.name.localeCompare(b.name)))
    setFname(''); setFemail('')
  }

  const removeFriend = async (id) => { await deleteFriend(id); setFriends(f => f.filter(fr => fr.id !== id)) }

  // ── settle debt ───────────────────────────────────────────
  const settle = async (id) => { await settleDebt(id); load() }
  const settleAll = async (friendId) => { await settleAllFriendDebts(user.id, friendId); load() }

  // ── winnings ──────────────────────────────────────────────
  const saveWinning = async () => {
    setWinErr('')
    if (!winTitle.trim()) return setWinErr('Title is required')
    if (!winAmount || isNaN(winAmount) || parseFloat(winAmount) <= 0) return setWinErr('Enter a valid amount')
    const { error } = await addWinning(user.id, winTitle.trim(), parseFloat(winAmount))
    if (error) return setWinErr(error.message)
    setWinTitle(''); setWinAmount(''); setWinErr('')
    load()
  }

  const removeWinning = async (id) => { await deleteWinning(id); load() }

  // ── EMIs ──────────────────────────────────────────────────
  const saveEmi = async () => {
    setEmiErr('')
    if (!emiForm.title.trim()) return setEmiErr('Title is required')
    if (!emiForm.amount || isNaN(emiForm.amount) || parseFloat(emiForm.amount) <= 0) return setEmiErr('Enter a valid amount')
    if (!emiForm.totalMonths || isNaN(emiForm.totalMonths) || parseInt(emiForm.totalMonths) <= 0) return setEmiErr('Enter valid number of months')
    const { error } = await addEmi(user.id, emiForm.title.trim(), parseFloat(emiForm.amount), parseInt(emiForm.totalMonths))
    if (error) return setEmiErr(error.message)
    setEmiForm({ title: '', amount: '', totalMonths: '' }); setEmiErr('')
    load()
  }

  // ── KEY CHANGE: pass emi.title so payEmi can create the transaction
  const toggleEmiPay = async (emi) => {
    setEmiLoading(emi.id)
    if (isEmiPaidThisMonth(emi)) {
      await unpayEmi(emi.id)
    } else {
      await payEmi(user.id, emi.id, Number(emi.amount), emi.title)
    }
    setEmiLoading('')
    load()
  }

  const removeEmi = async (id) => { await deleteEmi(id); load() }

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#09090f] text-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 border-b border-white/6 bg-[#09090f]/85 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-400 rounded-lg flex items-center justify-center text-[#09090f] font-bold text-sm">₹</div>
          <span className="font-semibold tracking-tight">Spendly</span>
          <span className="text-white/20 text-xs">{MONTHS[currentMonth-1]} {currentYear}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowTagMgr(true)} className="hidden sm:block text-xs text-white/45 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 transition-all">🏷 Tags</button>
          <button onClick={() => setShowEmis(true)} className={`hidden sm:block text-xs px-2.5 py-1.5 rounded-lg border transition-all ${emis.length > 0 ? 'text-violet-300 bg-violet-400/8 border-violet-400/20 hover:bg-violet-400/15' : 'text-white/45 bg-white/5 border-white/8 hover:bg-white/10'}`}>📋 EMIs</button>
          <button onClick={() => setShowFriends(true)} className="hidden sm:block text-xs text-white/45 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 transition-all">👥 Friends</button>
          <button
            onClick={() => setShowAllDebts(true)}
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
              pendingDebts.length > 0 ? 'text-amber-300 bg-amber-400/10 border-amber-400/20 hover:bg-amber-400/15' : 'text-white/45 bg-white/5 border-white/8 hover:bg-white/10'
            }`}
          >
            💳 Debts
            {pendingDebts.length > 0 && <span className="bg-amber-400 text-[#09090f] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingDebts.length}</span>}
          </button>
          <button onClick={() => navigate('/analytics')} className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all text-violet-300 bg-violet-400/8 border-violet-400/20 hover:bg-violet-400/15">📊 Analytics</button>
          <div className="w-px h-4 bg-white/10 hidden sm:block" />
          <div className="w-7 h-7 rounded-full bg-emerald-400/15 border border-emerald-400/25 flex items-center justify-center text-emerald-400 text-xs font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <button onClick={handleSignOut} className="text-xs text-white/30 hover:text-white/60 transition-colors">Sign out</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-7 space-y-5">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin" />
          </div>
        ) : (<>

          {/* ── Budget Card ── */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950/50 to-[#111118] border border-emerald-500/15 rounded-2xl p-6">
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-emerald-400/8 blur-2xl pointer-events-none" />
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs text-white/30 uppercase tracking-widest mb-1">{MONTHS[currentMonth-1]} {currentYear} Budget</p>
                <div className="flex items-baseline gap-2.5">
                  <p className="text-4xl font-bold">{effectiveBudget > 0 ? fmt(effectiveBudget) : <span className="text-white/20">Not set</span>}</p>
                  {totalWinnings > 0 && (
                    <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                      +{fmt(totalWinnings)} slice
                    </span>
                  )}
                </div>
                {budgetAmt > 0 && totalWinnings > 0 && (
                  <p className="text-xs text-white/25 mt-0.5">Base: {fmt(budgetAmt)}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <button
                  onClick={() => { setBudgetInput(budgetAmt > 0 ? String(budgetAmt) : ''); setShowBudget(true) }}
                  className="text-xs px-3 py-1.5 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 border border-emerald-400/20 rounded-xl transition-all"
                >
                  {budgetAmt > 0 ? '✏️ Edit' : '+ Set Budget'}
                </button>
                <button
                  onClick={() => setShowWinnings(true)}
                  className="text-xs px-3 py-1.5 bg-violet-400/10 hover:bg-violet-400/20 text-violet-300 border border-violet-400/20 rounded-xl transition-all"
                >
                  🎰 Slice Winnings
                </button>
              </div>
            </div>
            {budgetAmt > 0 ? (<>
              <div className="mb-4">
                <div className="flex justify-between text-xs text-white/30 mb-1.5">
                  <span>
                    Spent {fmt(totalSpent)}
                    {emiPaidThisMonth > 0 && <span className="text-violet-300/70"> (incl. {fmt(emiPaidThisMonth)} EMI)</span>}
                  </span>
                  <span>{pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${pct > 85 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Remaining', val: fmt(remaining), color: remaining < 0 ? 'text-red-400' : 'text-white', bg: 'bg-white/4' },
                  { label: 'To Collect', val: fmt(pendingTotal), color: 'text-amber-300', bg: 'bg-amber-400/8 border border-amber-400/12' },
                  { label: 'After Debts', val: fmt(afterDebts), color: 'text-emerald-300', bg: 'bg-emerald-400/8 border border-emerald-400/12' },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className={`text-sm font-semibold ${color}`}>{val}</p>
                  </div>
                ))}
              </div>
            </>) : (
              <p className="text-sm text-white/25">Set a monthly budget to start tracking.</p>
            )}
          </div>

          {/* Mobile quick actions */}
          <div className="grid grid-cols-5 gap-2 sm:hidden">
            {[
              { label: '🏷 Tags', fn: () => setShowTagMgr(true), cls: 'text-white/50' },
              { label: '👥 Friends', fn: () => setShowFriends(true), cls: 'text-white/50' },
              { label: `💳 Debts${pendingDebts.length > 0 ? ` (${pendingDebts.length})` : ''}`, fn: () => setShowAllDebts(true), cls: pendingDebts.length > 0 ? 'text-amber-300' : 'text-white/50' },
              { label: '📋 EMIs', fn: () => setShowEmis(true), cls: emis.length > 0 ? 'text-violet-300' : 'text-white/50' },
              { label: '📊 Stats', fn: () => navigate('/analytics'), cls: 'text-violet-300' },
            ].map(({ label, fn, cls }) => (
              <button key={label} onClick={fn} className={`py-2.5 text-xs bg-white/5 border border-white/8 rounded-xl hover:bg-white/10 transition-all ${cls}`}>{label}</button>
            ))}
          </div>

          {/* ── Pending Debts Strip ── */}
          {pendingDebts.length > 0 && (
            <div className="bg-amber-400/6 border border-amber-400/15 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-300">💳 Pending collections</p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-300 text-sm">{fmt(pendingTotal)}</span>
                  {pendingDebts.length > 3 && (
                    <button onClick={() => setShowAllDebts(true)} className="text-xs text-amber-300/50 hover:text-amber-300 transition-colors">See all →</button>
                  )}
                </div>
              </div>
              {pendingDebts.slice(0, 3).map(d => {
                const txnTags = d.txn_tags || []
                return (
                  <div key={d.id} className="flex items-center justify-between bg-black/25 rounded-xl px-3 py-2.5 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{d.friends?.name}</p>
                      <p className="text-xs text-white/30 truncate">{d.transactions?.title}</p>
                      {txnTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {txnTags.map(t => <TagPill key={t.id} tag={t} small />)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-amber-300">{fmt(d.amount)}</span>
                      <button onClick={() => settle(d.id)} className="text-xs bg-emerald-400/15 hover:bg-emerald-400/25 text-emerald-400 px-2.5 py-1 rounded-lg transition-all">✓ Collected</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Running EMIs ── */}
          {emis.length > 0 && (
            <div className="bg-violet-500/6 border border-violet-500/15 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-violet-300">📋 Running EMIs</p>
                <button onClick={() => setShowEmis(true)} className="text-xs text-violet-300/50 hover:text-violet-300 transition-colors">Manage →</button>
              </div>
              {emis.map(emi => {
                const paid = getEmiProgress(emi)
                const paidNow = isEmiPaidThisMonth(emi)
                const remaining_months = emi.total_months - paid
                return (
                  <div key={emi.id} className="flex items-center justify-between bg-black/25 rounded-xl px-3 py-2.5 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{emi.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-white/30">{fmt(emi.amount)}/mo · {paid}/{emi.total_months} paid</p>
                        {remaining_months > 0 && <p className="text-xs text-violet-300/50">{remaining_months} left</p>}
                        {remaining_months === 0 && <p className="text-xs text-emerald-400/70">Complete ✓</p>}
                      </div>
                      {/* Progress dots */}
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {Array.from({ length: emi.total_months }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i < paid ? 'bg-emerald-400' : i === paid && paidNow ? 'bg-emerald-400' : 'bg-white/10'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleEmiPay(emi)}
                      disabled={emiLoading === emi.id || remaining_months === 0}
                      className={`shrink-0 text-xs font-medium px-3 py-2 rounded-xl border transition-all disabled:opacity-40 ${
                        paidNow
                          ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/25 hover:bg-red-400/15 hover:text-red-400 hover:border-red-400/25'
                          : 'bg-violet-400/15 text-violet-300 border-violet-400/25 hover:bg-violet-400/25'
                      }`}
                    >
                      {emiLoading === emi.id
                        ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block" />
                        : paidNow ? '✓ Paid' : 'Mark Paid'
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Transactions ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">
                Transactions
                {transactions.length > 0 && <span className="ml-2 text-xs text-white/20 font-normal">{transactions.length} this month</span>}
              </h2>
              <button
                onClick={() => { resetTxn(); setShowTxn(true) }}
                className="flex items-center gap-1.5 bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-[#09090f] font-semibold text-sm px-4 py-2 rounded-xl transition-all"
              >
                + Add Expense
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="border border-dashed border-white/8 rounded-2xl p-14 flex flex-col items-center text-center">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-white/30 text-sm mb-3">No expenses this month</p>
                <button onClick={() => { resetTxn(); setShowTxn(true) }} className="text-sm text-emerald-400 hover:underline">Add your first expense →</button>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(t => {
                  const unsettled  = t.debts?.filter(d => !d.is_settled) || []
                  const debtSum    = unsettled.reduce((s, d) => s + Number(d.amount), 0)
                  const txnTags    = t.txn_tags || []
                  const isEmiTxn   = !!t.emi_id
                  const isCredit   = Number(t.my_amount) < 0   // debt collected / refund
                  const displayAmt = Math.abs(Number(t.my_amount))
                  return (
                    <div key={t.id} className={`group flex items-start gap-3 border rounded-2xl px-4 py-3.5 transition-all ${
                      isCredit
                        ? 'bg-emerald-400/[0.04] hover:bg-emerald-400/[0.07] border-emerald-400/15'
                        : 'bg-white/[0.025] hover:bg-white/[0.05] border-white/6'
                    }`}>
                      <div className="text-xl shrink-0 mt-0.5">
                        {isCredit ? '💰' : isEmiTxn ? '📋' : (CAT_ICON[t.category] || '📦')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="font-medium text-sm text-white">{t.title}</p>
                          {isCredit && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">Collected</span>
                          )}

                          {isEmiTxn && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-400/15 text-violet-300 border border-violet-400/20">EMI</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-white/30 mb-1.5">
                          <span>{new Date(t.date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</span>
                          {!isCredit && t.total_amount !== t.my_amount && <span>Total paid: {fmt(t.total_amount)}</span>}
                          {debtSum > 0 && (
                            <span className="text-amber-300/70">
                              {unsettled.map(d => d.friends?.name).join(', ')} owe{unsettled.length===1?'s':''} {fmt(debtSum)}
                            </span>
                          )}
                          {t.note && <span className="italic text-white/20">{t.note}</span>}
                        </div>
                        {txnTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {txnTags.map(tag => <TagPill key={tag.id} tag={tag} small />)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-start gap-2 shrink-0 mt-0.5">
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${isCredit ? 'text-emerald-400' : ''}`}>
                            {isCredit ? '+' : ''}{fmt(displayAmt)}
                          </p>
                          {!isCredit && t.total_amount !== t.my_amount && <p className="text-[10px] text-white/20">of {fmt(t.total_amount)}</p>}
                        </div>
                        {!isEmiTxn && !isCredit && (
                          <button
                            onClick={() => { if (window.confirm('Delete this transaction?')) deleteTransaction(t.id).then(load) }}
                            className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 text-lg transition-all"
                          >×</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>)}
      </main>

      {/* ══ MODAL: Budget ══ */}
      <Modal open={showBudget} onClose={() => setShowBudget(false)} title="Set Monthly Budget">
        <div className="space-y-4">
          <p className="text-sm text-white/30">Spending limit for {MONTHS[currentMonth-1]} {currentYear}</p>
          <div>
            <label className={lCls}>Budget Amount (₹)</label>
            <input className={iCls} type="number" placeholder="e.g. 15000" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} autoFocus onKeyDown={e => e.key==='Enter' && saveBudget()} />
          </div>
          <button onClick={saveBudget} className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-[#09090f] font-semibold text-sm rounded-xl transition-all">Save Budget</button>
        </div>
      </Modal>

      {/* ══ MODAL: Add Transaction ══ */}
      <Modal open={showTxn} onClose={() => { setShowTxn(false); resetTxn() }} title="Add Expense">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-0.5">

          <div>
            <label className={lCls}>Title *</label>
            <input className={iCls} type="text" placeholder="e.g. Dinner at Pizza Hut" value={txn.title} onChange={e => setTxn(f=>({...f,title:e.target.value}))} autoFocus />
          </div>

          <div>
            <label className={lCls}>Total Amount (₹) *</label>
            <input className={iCls} type="number" placeholder="100" value={txn.totalAmount} onChange={e => handleTotalChange(e.target.value)} />
          </div>

          <div>
            <label className={lCls}>Date</label>
            <input className={iCls} type="date" value={txn.date} onChange={e => setTxn(f=>({...f,date:e.target.value}))} />
          </div>

          {/* Tags */}
          <div>
            <label className={lCls}>Tags</label>
            <TagSelector
              allTags={tags}
              selectedIds={selectedTagIds}
              onChange={setSelectedTagIds}
              onCreateTag={handleCreateTag}
            />
          </div>

          {/* Split section */}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Split with Friends</p>
              {friends.length > 0 ? (
                <button type="button" onClick={addSplit} className="text-xs text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 px-2.5 py-1 rounded-lg transition-all">+ Add Friend</button>
              ) : (
                <button type="button" onClick={() => { setShowTxn(false); setShowFriends(true) }} className="text-xs text-white/30 hover:text-emerald-400 transition-colors">Add friends first →</button>
              )}
            </div>

            {splits.map((sp, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  {i === 0 && <label className={lCls}>Friend</label>}
                  <select className={sCls} value={sp.friendId} onChange={e => updateSplit(i,'friendId',e.target.value)}>
                    <option value="">Select friend</option>
                    {friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  {i === 0 && <label className={lCls}>Their share (₹)</label>}
                  <input className={iCls} type="number" placeholder="40" value={sp.amount} onChange={e => updateSplit(i,'amount',e.target.value)} />
                </div>
                <button onClick={() => removeSplit(i)} className="pb-0.5 text-white/25 hover:text-red-400 text-xl transition-colors">×</button>
              </div>
            ))}

            {splits.length > 0 && (
              <div className="pt-2 border-t border-white/6">
                <label className={lCls}>My Share (₹) — auto calculated</label>
                <div className="flex gap-2 items-center">
                  <input
                    className={`${iCls} flex-1 bg-emerald-400/5 border-emerald-400/30 text-emerald-300`}
                    type="number"
                    value={txn.myAmount}
                    onChange={e => setTxn(f=>({...f,myAmount:e.target.value}))}
                    placeholder="Auto"
                  />
                  <span className="text-xs text-white/25">editable</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={lCls}>Note (optional)</label>
            <input className={iCls} type="text" placeholder="Any details..." value={txn.note} onChange={e => setTxn(f=>({...f,note:e.target.value}))} />
          </div>

          {txnErr && <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3">{txnErr}</div>}

          {txn.totalAmount && (
            <div className="bg-white/[0.03] rounded-xl px-4 py-3 space-y-1.5 text-xs border border-white/6">
              <p className="text-white/30 font-medium uppercase tracking-wider text-[10px] mb-2">Summary</p>
              <div className="flex justify-between text-white/40"><span>Total you paid</span><span className="text-white font-medium">{fmt(txn.totalAmount||0)}</span></div>
              <div className="flex justify-between text-white/40"><span>Counts toward your budget</span><span className="text-emerald-400 font-medium">{fmt(txn.myAmount||txn.totalAmount||0)}</span></div>
              {splits.filter(s=>s.amount&&s.friendId).map((sp,i) => {
                const fr = friends.find(f=>f.id===sp.friendId)
                return <div key={i} className="flex justify-between text-white/40"><span>{fr?.name||'Friend'} owes you</span><span className="text-amber-300 font-medium">{fmt(sp.amount)}</span></div>
              })}
              {selectedTagIds.length > 0 && (
                <div className="flex gap-1 pt-1 flex-wrap">
                  {selectedTagIds.map(id => { const t=tags.find(t=>t.id===id); return t ? <TagPill key={id} tag={t} small /> : null })}
                </div>
              )}
            </div>
          )}

          <button
            onClick={saveTxn}
            disabled={txnLoading}
            className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-[#09090f] font-semibold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {txnLoading && <span className="w-4 h-4 border-2 border-[#09090f]/30 border-t-[#09090f] rounded-full animate-spin" />}
            Save Expense
          </button>
        </div>
      </Modal>

      {/* ══ MODAL: Manage Tags ══ */}
      <Modal open={showTagMgr} onClose={() => setShowTagMgr(false)} title="🏷 Manage Tags">
        <div className="space-y-4">
          <p className="text-sm text-white/30">Tags help you categorise and filter expenses across friends.</p>
          {tags.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-4">No tags yet — create one when adding an expense.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(t => (
                <TagPill key={t.id} tag={t} onRemove={handleDeleteTag} />
              ))}
            </div>
          )}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
            <TagSelector allTags={tags} selectedIds={[]} onChange={() => {}} onCreateTag={handleCreateTag} />
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: Friends ══ */}
      <Modal open={showFriends} onClose={() => setShowFriends(false)} title="👥 Friends">
        <div className="space-y-4">
          <div className="grid gap-2">
            <div className="flex gap-2">
              <input className={iCls} placeholder="Name *" value={fname} onChange={e => setFname(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveFriend()} />
              <input className={iCls} placeholder="Email (optional)" value={femail} onChange={e => setFemail(e.target.value)} />
            </div>
            <button onClick={saveFriend} className="w-full py-2.5 bg-emerald-400 hover:bg-emerald-300 text-[#09090f] font-semibold text-sm rounded-xl transition-all">Add Friend</button>
          </div>
          {fErr && <p className="text-red-400 text-xs">{fErr}</p>}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {friends.length === 0 ? (
              <p className="text-center text-white/20 text-sm py-4">No friends added yet</p>
            ) : friends.map(f => {
              const owed = pendingDebts.filter(d=>d.friend_id===f.id).reduce((s,d)=>s+Number(d.amount),0)
              return (
                <div key={f.id} className="flex items-center justify-between bg-white/4 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{f.name}</p>
                    {f.email && <p className="text-xs text-white/30">{f.email}</p>}
                    {owed > 0 && <p className="text-xs text-amber-300">Owes you {fmt(owed)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setShowFriends(false); setFriendDetail(f) }}
                      className="text-xs text-emerald-400/70 hover:text-emerald-400 bg-emerald-400/8 hover:bg-emerald-400/15 px-2.5 py-1 rounded-lg transition-all"
                    >
                      View debts
                    </button>
                    {owed > 0 && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Collect all debts from ${f.name}? (${fmt(owed)})`)) return
                          await settleAll(f.id)
                        }}
                        className="text-xs text-amber-300/70 hover:text-amber-300 bg-amber-400/8 hover:bg-amber-400/15 px-2.5 py-1 rounded-lg transition-all"
                      >
                        ✓ Collect all
                      </button>
                    )}
                    <button onClick={() => removeFriend(f.id)} className="text-xs text-white/20 hover:text-red-400 transition-colors">Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: All Pending Debts ══ */}
      <Modal open={showAllDebts} onClose={() => setShowAllDebts(false)} title="💳 Pending Debts">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {pendingDebts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-white/30 text-sm">No pending debts!</p>
            </div>
          ) : (<>
            <div className="flex justify-between text-xs text-white/30 pb-2 border-b border-white/6">
              <span>{pendingDebts.length} pending</span>
              <span className="text-amber-300 font-medium">{fmt(pendingTotal)} to collect</span>
            </div>
            {pendingDebts.map(d => {
              const txnTags = d.txn_tags||[]
              return (
                <div key={d.id} className="flex items-start justify-between gap-2 bg-white/[0.03] border border-white/6 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.friends?.name}</p>
                    <p className="text-xs text-white/30">{d.transactions?.title}</p>
                    <p className="text-xs text-white/20">{d.transactions?.date && new Date(d.transactions.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>
                    {txnTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {txnTags.map(t=><TagPill key={t.id} tag={t} small />)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <span className="text-base font-semibold text-amber-300">{fmt(d.amount)}</span>
                    <button
                      onClick={() => settle(d.id)}
                      className="text-xs bg-emerald-400/15 hover:bg-emerald-400/25 text-emerald-400 border border-emerald-400/20 px-3 py-1.5 rounded-xl transition-all font-medium"
                    >
                      ✓ Collected
                    </button>
                  </div>
                </div>
              )
            })}
          </>)}
        </div>
      </Modal>

      {/* ══ MODAL: Friend Debt Detail ══ */}
      <FriendDetailModal
        friend={friendDetail}
        open={!!friendDetail}
        onClose={() => { setFriendDetail(null); load() }}
        onSettle={settle}
        onSettleAll={settleAll}
        userId={user?.id}
      />

      {/* ══ MODAL: Slice Winnings ══ */}
      <Modal open={showWinnings} onClose={() => setShowWinnings(false)} title="🎰 Slice Winnings">
        <div className="space-y-4">
          <p className="text-sm text-white/35">Add Slice winnings to boost your budget for {MONTHS[currentMonth-1]}.</p>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input className={iCls} placeholder="e.g. Weekend Slice win" value={winTitle} onChange={e => setWinTitle(e.target.value)} onKeyDown={e => e.key==='Enter' && saveWinning()} />
              <input className={`${iCls} w-28 shrink-0`} type="number" placeholder="₹ Amount" value={winAmount} onChange={e => setWinAmount(e.target.value)} />
            </div>
            <button onClick={saveWinning} className="w-full py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm rounded-xl transition-all">
              + Add Winning
            </button>
          </div>
          {winErr && <p className="text-red-400 text-xs">{winErr}</p>}

          {winnings.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-3">No winnings added this month</p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/30 pb-1 border-b border-white/6">
                <span>{winnings.length} entries</span>
                <span className="text-violet-300 font-medium">Total: {fmt(totalWinnings)}</span>
              </div>
              {winnings.map(w => (
                <div key={w.id} className="group flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-white">{w.title}</p>
                    <p className="text-xs text-white/30">{new Date(w.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-violet-300">+{fmt(w.amount)}</span>
                    <button onClick={() => removeWinning(w.id)} className="text-white/20 hover:text-red-400 transition-colors text-base">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ══ MODAL: Running EMIs ══ */}
      <Modal open={showEmis} onClose={() => setShowEmis(false)} title="📋 Running EMIs">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-0.5">
          <p className="text-sm text-white/35">Track monthly installments. Mark each month as paid to deduct from your budget.</p>

          {/* Add form */}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Add New EMI</p>
            <div>
              <label className={lCls}>What is this EMI for?</label>
              <input className={iCls} placeholder="e.g. iPhone 15 Pro, Bike loan" value={emiForm.title} onChange={e => setEmiForm(f=>({...f,title:e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>Monthly Amount (₹)</label>
                <input className={iCls} type="number" placeholder="2500" value={emiForm.amount} onChange={e => setEmiForm(f=>({...f,amount:e.target.value}))} />
              </div>
              <div>
                <label className={lCls}>Total Months</label>
                <input className={iCls} type="number" placeholder="12" value={emiForm.totalMonths} onChange={e => setEmiForm(f=>({...f,totalMonths:e.target.value}))} />
              </div>
            </div>
            {emiErr && <p className="text-red-400 text-xs">{emiErr}</p>}
            <button onClick={saveEmi} className="w-full py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm rounded-xl transition-all">
              + Add EMI
            </button>
          </div>

          {/* EMI list */}
          {emis.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-3">No running EMIs</p>
          ) : (
            <div className="space-y-3">
              {emis.map(emi => {
                const paid = getEmiProgress(emi)
                const paidNow = isEmiPaidThisMonth(emi)
                const remaining_months = emi.total_months - paid
                const totalLeft = remaining_months * Number(emi.amount)
                const payments = emi.emi_payments || []

                return (
                  <div key={emi.id} className="bg-white/[0.03] border border-violet-500/15 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-white">{emi.title}</p>
                        <p className="text-xs text-white/35 mt-0.5">{fmt(emi.amount)}/month · {emi.total_months} months total</p>
                      </div>
                      <button onClick={() => removeEmi(emi.id)} className="text-white/20 hover:text-red-400 transition-colors text-lg">×</button>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-white/30 mb-1">
                        <span>{paid}/{emi.total_months} paid</span>
                        <span>{remaining_months > 0 ? `${fmt(totalLeft)} remaining` : '🎉 Complete!'}</span>
                      </div>
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((paid / emi.total_months) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Month dots */}
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: emi.total_months }).map((_, i) => {
                        const isThisMonth = i === paid && !paidNow
                        const isPast = i < paid
                        const isCurrent = i === paid && paidNow
                        return (
                          <div
                            key={i}
                            title={`Month ${i+1}`}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                              isPast || isCurrent ? 'bg-emerald-400 text-[#09090f]' :
                              isThisMonth ? 'bg-violet-400/30 border border-violet-400/50 text-violet-300' :
                              'bg-white/8 text-white/25'
                            }`}
                          >
                            {i+1}
                          </div>
                        )
                      })}
                    </div>

                    {/* Payment history */}
                    {payments.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-white/6">
                        <p className="text-[10px] text-white/25 uppercase tracking-wider">Payment history</p>
                        {[...payments].sort((a,b) => b.year - a.year || b.month - a.month).map(p => (
                          <div key={p.id} className="flex justify-between text-xs text-white/35">
                            <span>{MONTHS[p.month-1]} {p.year}</span>
                            <span className="text-emerald-400/70">{fmt(p.amount)} paid</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* This month action */}
                    {remaining_months > 0 && (
                      <button
                        onClick={() => toggleEmiPay(emi)}
                        disabled={emiLoading === emi.id}
                        className={`w-full py-2.5 text-sm font-semibold rounded-xl border transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${
                          paidNow
                            ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20'
                            : 'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30'
                        }`}
                      >
                        {emiLoading === emi.id
                          ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          : paidNow
                            ? `✓ ${MONTHS[currentMonth-1]} Paid — click to undo`
                            : `Mark ${MONTHS[currentMonth-1]} as Paid (${fmt(emi.amount)})`
                        }
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

    </div>
  )
}