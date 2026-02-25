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

// ─── constants ───────────────────────────────────────────────
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CATEGORIES = ['Food','Transport','Shopping','Entertainment','Health','Bills','Education','General']
const CAT_ICON = { Food:'🍕', Transport:'🚗', Shopping:'🛍', Entertainment:'🎬', Health:'💊', Bills:'💡', Education:'📚', General:'📦' }

const TAG_PALETTE = [
  '#6ee7b7','#67e8f9','#a78bfa','#f9a8d4','#fcd34d',
  '#86efac','#fb923c','#f87171','#60a5fa','#e879f9',
]

const tagStyle = (color) => ({
  background: color + '22',
  color: color,
  borderColor: color + '55',
})

// ─── Glass classes ────────────────────────────────────────────
// Input: rich glass feel, full contrast on mobile
const iCls = "w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/60 focus:bg-emerald-400/[0.05] transition-all caret-emerald-400"
const sCls = "w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-3.5 text-sm text-white outline-none focus:border-emerald-400/60 transition-all appearance-none"
const lCls = "text-[11px] font-semibold text-white/50 uppercase tracking-widest mb-2 block"

// ─── Modal ────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, wide, children }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} sm:mx-4`}
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,35,0.97) 0%, rgba(12,12,22,0.99) 100%)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          boxShadow: '0 -8px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        // On sm+, make it a centered dialog
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,35,0.97) 0%, rgba(12,12,22,0.99) 100%)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 'clamp(16px, 4vw, 24px) clamp(16px, 4vw, 24px) 0 0',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 -8px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
          maxHeight: '92dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle (mobile hint) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <h3 className="font-semibold text-white text-base">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 text-white/60 hover:text-white text-lg transition-all"
          >×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 overflow-y-auto flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>

        {/* Safe area bottom padding */}
        <div className="shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '4px' }} />
      </div>
    </div>
  )
}

// ─── Tag Pill ─────────────────────────────────────────────────
const TagPill = ({ tag, onRemove, small }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border font-semibold ${small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'}`}
    style={tagStyle(tag.color)}
  >
    {tag.name}
    {onRemove && (
      <button onClick={() => onRemove(tag.id)} className="hover:opacity-60 transition-opacity leading-none ml-0.5">×</button>
    )}
  </span>
)

// ─── Tag Selector ─────────────────────────────────────────────
const TagSelector = ({ allTags, selectedIds, onChange, onCreateTag }) => {
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

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
    <div className="space-y-3">
      {/* Existing tags */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {allTags.map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all active:scale-95 ${
              selectedIds.includes(tag.id) ? 'opacity-100 scale-105 shadow-lg' : 'opacity-40 hover:opacity-70'
            }`}
            style={tagStyle(tag.color)}
          >
            {selectedIds.includes(tag.id) && <span className="text-[10px]">✓</span>}
            {tag.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setCreating(v => !v); setTimeout(() => inputRef.current?.focus(), 100) }}
          className="text-xs px-3 py-1.5 rounded-full border border-dashed border-white/25 text-white/40 hover:text-white/70 hover:border-white/50 transition-all"
        >
          {creating ? '✕ cancel' : '＋ new tag'}
        </button>
      </div>

      {/* Create new tag — full width for mobile legibility */}
      {creating && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <label className={lCls}>Tag Name</label>
            <input
              ref={inputRef}
              className={iCls}
              placeholder="e.g. Food, Trip, Work..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontSize: '16px' }} // prevents zoom on iOS
            />
          </div>
          <div>
            <label className={lCls}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {TAG_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`w-8 h-8 rounded-full transition-all active:scale-90 ${newTagColor === c ? 'scale-125 ring-2 ring-white/50 ring-offset-2 ring-offset-[#0d0d1a]' : 'opacity-60 hover:opacity-100'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={loading || !newTagName.trim()}
            className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] disabled:opacity-40 text-[#09090f] font-bold text-sm rounded-2xl transition-all"
          >
            {loading ? '...' : `Add "${newTagName || 'tag'}"`}
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

  const pending = debts.filter(d => !d.is_settled)
  const settled = debts.filter(d => d.is_settled)
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
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary Card */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-white/40 mb-1">Currently owes you</p>
                  <p className="text-2xl font-bold text-amber-300">{fmt(totalOwed)}</p>
                  <p className="text-xs text-white/30 mt-1">{pending.length} pending · {settled.length} settled</p>
                </div>
                {pending.length > 1 && (
                  <button
                    onClick={handleSettleAll}
                    disabled={settlingAll}
                    className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 active:scale-95 disabled:opacity-50 text-[#09090f] font-bold text-sm px-4 py-3 rounded-2xl transition-all shrink-0"
                  >
                    {settlingAll ? <span className="w-4 h-4 border-2 border-[#09090f]/30 border-t-[#09090f] rounded-full animate-spin" /> : '✓✓'}
                    <span className="hidden sm:inline">Collect All ({fmt(totalOwed)})</span>
                    <span className="sm:hidden">All</span>
                  </button>
                )}
              </div>
            </div>

            {pending.length > 0 && (
              <div>
                <p className={lCls}>Pending</p>
                <div className="space-y-2">
                  {pending.map(d => {
                    const txn = d.transactions
                    const tags = d.txn_tags || []
                    return (
                      <div key={d.id} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{txn?.title}</p>
                            <p className="text-xs text-white/35 mt-0.5">
                              {txn?.date && new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {txn?.note && <> · <span className="italic">{txn.note}</span></>}
                            </p>
                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {tags.map(t => <TagPill key={t.id} tag={t} small />)}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-base font-bold text-amber-300">{fmt(d.amount)}</span>
                            <button
                              onClick={async () => { await onSettle(d.id); setDebts(prev => prev.map(x => x.id === d.id ? { ...x, is_settled: true, settled_at: new Date().toISOString() } : x)) }}
                              className="text-xs bg-emerald-400/15 hover:bg-emerald-400/25 active:scale-95 text-emerald-400 border border-emerald-400/25 px-3 py-2 rounded-xl transition-all font-semibold whitespace-nowrap"
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

            {settled.length > 0 && (
              <div>
                <p className={lCls} style={{ opacity: 0.5 }}>Settled History</p>
                <div className="space-y-2">
                  {settled.map(d => {
                    const txn = d.transactions
                    const tags = d.txn_tags || []
                    return (
                      <div key={d.id} className="flex items-start justify-between gap-2 rounded-2xl px-4 py-3 opacity-45" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white line-through">{txn?.title}</p>
                          <p className="text-xs text-white/30">
                            {txn?.date && new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {d.settled_at && <> · {new Date(d.settled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm text-white/40 line-through">{fmt(d.amount)}</span>
                          <span className="text-[10px] text-emerald-400/70 bg-emerald-400/10 px-2 py-0.5 rounded-full">Settled</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {debts.length === 0 && (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">👍</p>
                <p className="text-white/30 text-sm">No debts with {friend.name} yet</p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Glass Card ───────────────────────────────────────────────
const GlassCard = ({ children, className = '', glow = '' }) => (
  <div
    className={`rounded-3xl ${className}`}
    style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: glow
        ? `0 8px 40px rgba(0,0,0,0.3), ${glow}`
        : '0 8px 40px rgba(0,0,0,0.3)',
    }}
  >
    {children}
  </div>
)

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const [budget, setBudget]      = useState(null)
  const [transactions, setTxns]  = useState([])
  const [friends, setFriends]    = useState([])
  const [tags, setTags]          = useState([])
  const [pendingDebts, setDebts] = useState([])
  const [winnings, setWinnings]  = useState([])
  const [emis, setEmis]          = useState([])
  const [loading, setLoading]    = useState(true)

  // Modals
  const [showBudget, setShowBudget]     = useState(false)
  const [showTxn, setShowTxn]           = useState(false)
  const [showFriends, setShowFriends]   = useState(false)
  const [showAllDebts, setShowAllDebts] = useState(false)
  const [showTagMgr, setShowTagMgr]     = useState(false)
  const [showWinnings, setShowWinnings] = useState(false)
  const [showEmis, setShowEmis]         = useState(false)
  const [friendDetail, setFriendDetail] = useState(null)

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
  const [showAllTxns, setShowAllTxns] = useState(false)

  // ── load ─────────────────────────────────────────────────
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
    setShowAllTxns(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ── computed ──────────────────────────────────────────────
  const budgetAmt = budget ? Number(budget.amount) : 0
  const totalWinnings = winnings.reduce((s, w) => s + Number(w.amount), 0)
  const effectiveBudget = budgetAmt + totalWinnings

  const emiPaidThisMonth = emis.reduce((s, emi) => {
    const paid = (emi.emi_payments || []).find(p => p.month === currentMonth && p.year === currentYear)
    return s + (paid ? Number(paid.amount) : 0)
  }, 0)

  const totalSpent = transactions.reduce((s, t) => {
    const myAmt = Number(t.my_amount)
    const totalAmt = Number(t.total_amount)
    if (myAmt < 0) return s + myAmt
    return s + totalAmt
  }, 0)
  const pendingTotal = pendingDebts.reduce((s, d) => s + Number(d.amount), 0)
  const remaining = effectiveBudget - totalSpent
  const afterDebts = remaining + pendingTotal
  const pct = effectiveBudget > 0 ? Math.min((totalSpent / effectiveBudget) * 100, 100) : 0

  const getEmiProgress = (emi) => (emi.emi_payments || []).length
  const isEmiPaidThisMonth = (emi) =>
    (emi.emi_payments || []).some(p => p.month === currentMonth && p.year === currentYear)

  // ── budget ────────────────────────────────────────────────
  const saveBudget = async () => {
    if (!budgetInput || isNaN(budgetInput)) return
    const { data } = await upsertBudget(user.id, parseFloat(budgetInput))
    if (data) { setBudget(data); setShowBudget(false); setBudgetInput('') }
  }

  // ── tags ─────────────────────────────────────────────────
  const handleCreateTag = async (name, color) => {
    const { data, error } = await createTag(user.id, name, color)
    if (!error && data) { setTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); return data }
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
    setTxn(f => ({ ...f, totalAmount: val, myAmount: recomputeMyShare(val, splits) }))
  }

  const addSplit = () => setSplits(s => [...s, { friendId: '', amount: '' }])

  const updateSplit = (i, key, val) => {
    const newSplits = splits.map((sp, idx) => idx === i ? { ...sp, [key]: val } : sp)
    setSplits(newSplits)
    if (key === 'amount') setTxn(f => ({ ...f, myAmount: recomputeMyShare(f.totalAmount, newSplits) }))
  }

  const removeSplit = (i) => {
    const newSplits = splits.filter((_, idx) => idx !== i)
    setSplits(newSplits)
    setTxn(f => ({ ...f, myAmount: recomputeMyShare(f.totalAmount, newSplits) }))
  }

  const saveTxn = async () => {
    setTxnErr('')
    const total = parseFloat(txn.totalAmount)
    const mine = parseFloat(txn.myAmount)
    if (!txn.title.trim()) return setTxnErr('Title is required')
    if (isNaN(total) || total <= 0) return setTxnErr('Enter a valid total amount')
    if (isNaN(mine) || mine < 0) return setTxnErr('My share is invalid')
    if (mine > total) return setTxnErr("Your share can't exceed total")
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
    setFriends(f => [...f, data].sort((a, b) => a.name.localeCompare(b.name)))
    setFname(''); setFemail('')
  }

  const removeFriend = async (id) => { await deleteFriend(id); setFriends(f => f.filter(fr => fr.id !== id)) }

  const settle = async (id) => { await settleDebt(id); load() }
  const settleAll = async (friendId) => { await settleAllFriendDebts(user.id, friendId); load() }

  // ── winnings ──────────────────────────────────────────────
  const saveWinning = async () => {
    setWinErr('')
    if (!winTitle.trim()) return setWinErr('Title is required')
    if (!winAmount || isNaN(winAmount) || parseFloat(winAmount) <= 0) return setWinErr('Enter a valid amount')
    const { error } = await addWinning(user.id, winTitle.trim(), parseFloat(winAmount))
    if (error) return setWinErr(error.message)
    setWinTitle(''); setWinAmount(''); setWinErr(''); load()
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
    setEmiForm({ title: '', amount: '', totalMonths: '' }); setEmiErr(''); load()
  }

  const toggleEmiPay = async (emi) => {
    setEmiLoading(emi.id)
    if (isEmiPaidThisMonth(emi)) await unpayEmi(emi.id)
    else await payEmi(user.id, emi.id, Number(emi.amount), emi.title)
    setEmiLoading(''); load()
  }

  const removeEmi = async (id) => { await deleteEmi(id); load() }
  const handleSignOut = async () => { await signOut(); navigate('/login') }

  // ─────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen text-white"
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: 'linear-gradient(160deg, #07070f 0%, #0d0d1c 40%, #080812 100%)',
        minHeight: '100dvh',
      }}
    >
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '60vw', height: '60vw', maxWidth: 500, maxHeight: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', top: '30%', right: '-10%', width: '50vw', height: '50vw', maxWidth: 400, maxHeight: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '0', left: '20%', width: '40vw', height: '40vw', maxWidth: 300, maxHeight: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* ── Nav ── */}
      <nav
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(7,7,15,0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base"
            style={{ background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)', color: '#07070f', boxShadow: '0 4px 16px rgba(52,211,153,0.3)' }}
          >₹</div>
          <div>
            <span className="font-bold tracking-tight text-sm">Spendly</span>
            <span className="ml-2 text-white/25 text-xs">{MONTHS[currentMonth - 1]} {currentYear}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Desktop nav buttons */}
          <button onClick={() => setShowTagMgr(true)} className="hidden sm:block text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-xl transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>🏷 Tags</button>
          <button onClick={() => setShowEmis(true)} className={`hidden sm:block text-xs px-3 py-1.5 rounded-xl border transition-all ${emis.length > 0 ? 'text-violet-300 border-violet-400/20' : 'text-white/50 border-white/8'}`} style={{ background: emis.length > 0 ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.06)' }}>📋 EMIs</button>
          <button onClick={() => setShowFriends(true)} className="hidden sm:block text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-xl transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>👥 Friends</button>
          <button
            onClick={() => setShowAllDebts(true)}
            className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${pendingDebts.length > 0 ? 'text-amber-300 border-amber-400/20' : 'text-white/50 border-white/8'}`}
            style={{ background: pendingDebts.length > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.06)' }}
          >
            💳 Debts
            {pendingDebts.length > 0 && <span className="bg-amber-400 text-[#07070f] text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingDebts.length}</span>}
          </button>
          <button onClick={() => navigate('/analytics')} className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all text-violet-300 border-violet-400/20" style={{ background: 'rgba(167,139,250,0.08)' }}>📊 Analytics</button>

          <div className="w-px h-4 bg-white/10 hidden sm:block" />
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-400 text-xs font-black"
            style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <button onClick={handleSignOut} className="text-xs text-white/30 hover:text-white/60 transition-colors">Out</button>
        </div>
      </nav>

      <main className="relative z-10 max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin" />
          </div>
        ) : (<>

          {/* ── Budget Hero Card ── */}
          <div
            className="relative overflow-hidden rounded-3xl p-5 sm:p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(16,28,22,0.95) 0%, rgba(10,14,20,0.98) 100%)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(52,211,153,0.15)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(52,211,153,0.05) inset, inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Glow */}
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)', filter: 'blur(20px)' }} />

            <div className="flex items-start justify-between mb-5 relative">
              <div>
                <p className="text-[10px] text-emerald-400/60 uppercase tracking-[0.2em] font-semibold mb-2">{MONTHS[currentMonth - 1]} {currentYear} · Budget</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className="text-3xl sm:text-4xl font-black tracking-tight">
                    {effectiveBudget > 0 ? fmt(effectiveBudget) : <span className="text-white/20">Not set</span>}
                  </p>
                  {totalWinnings > 0 && (
                    <span className="text-xs text-emerald-400 px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      +{fmt(totalWinnings)} slice
                    </span>
                  )}
                </div>
                {budgetAmt > 0 && totalWinnings > 0 && (
                  <p className="text-xs text-white/25 mt-1">Base: {fmt(budgetAmt)}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                <button
                  onClick={() => { setBudgetInput(budgetAmt > 0 ? String(budgetAmt) : ''); setShowBudget(true) }}
                  className="text-xs px-3 py-2 rounded-xl font-semibold transition-all active:scale-95"
                  style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}
                >
                  {budgetAmt > 0 ? '✏️ Edit' : '+ Set Budget'}
                </button>
                <button
                  onClick={() => setShowWinnings(true)}
                  className="text-xs px-3 py-2 rounded-xl font-semibold transition-all active:scale-95"
                  style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#c4b5fd' }}
                >
                  🎰 Winnings
                </button>
              </div>
            </div>

            {budgetAmt > 0 ? (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-white/35 mb-2">
                    <span>
                      Spent {fmt(totalSpent)}
                      {emiPaidThisMonth > 0 && <span className="text-violet-300/60 ml-1">(+{fmt(emiPaidThisMonth)} EMI)</span>}
                    </span>
                    <span className={pct > 85 ? 'text-red-400' : pct > 60 ? 'text-amber-400' : 'text-emerald-400/70'}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: pct > 85 ? 'linear-gradient(90deg, #f87171, #ef4444)' : pct > 60 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #34d399, #10b981)',
                        boxShadow: pct > 85 ? '0 0 12px rgba(248,113,113,0.4)' : pct > 60 ? '0 0 12px rgba(251,191,36,0.4)' : '0 0 12px rgba(52,211,153,0.35)',
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Remaining', val: fmt(remaining), color: remaining < 0 ? '#f87171' : 'rgba(255,255,255,0.9)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
                    { label: 'To Collect', val: fmt(pendingTotal), color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.15)' },
                    { label: 'After Debts', val: fmt(afterDebts), color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.15)' },
                  ].map(({ label, val, color, bg, border }) => (
                    <div key={label} className="rounded-2xl p-3 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1 font-semibold">{label}</p>
                      <p className="text-sm font-bold truncate" style={{ color }}>{val}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-white/25">Set a monthly budget to start tracking.</p>
            )}
          </div>

          {/* ── Mobile Quick Actions ── */}
          <div className="grid grid-cols-5 gap-1.5 sm:hidden">
            {[
              { icon: '🏷', label: 'Tags', fn: () => setShowTagMgr(true), active: false },
              { icon: '👥', label: 'Friends', fn: () => setShowFriends(true), active: false },
              { icon: '💳', label: `Debts${pendingDebts.length > 0 ? ` ${pendingDebts.length}` : ''}`, fn: () => setShowAllDebts(true), active: pendingDebts.length > 0 },
              { icon: '📋', label: 'EMIs', fn: () => setShowEmis(true), active: emis.length > 0 },
              { icon: '📊', label: 'Stats', fn: () => navigate('/analytics'), active: true },
            ].map(({ icon, label, fn, active }) => (
              <button
                key={label}
                onClick={fn}
                className="py-3 rounded-2xl text-center transition-all active:scale-95"
                style={{
                  background: active ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.05)',
                  border: active ? '1px solid rgba(167,139,250,0.2)' : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="text-base leading-none">{icon}</div>
                <div className={`text-[9px] font-semibold mt-1 ${active ? 'text-violet-300' : 'text-white/40'}`}>{label}</div>
              </button>
            ))}
          </div>

          {/* ── Pending Debts ── */}
          {pendingDebts.length > 0 && (
            <div className="rounded-3xl p-4 space-y-2.5" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', boxShadow: '0 4px 24px rgba(251,191,36,0.04)' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-amber-300">💳 Pending collections</p>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-300 text-sm">{fmt(pendingTotal)}</span>
                  {pendingDebts.length > 3 && (
                    <button onClick={() => setShowAllDebts(true)} className="text-xs text-amber-300/50 hover:text-amber-300 transition-colors">See all →</button>
                  )}
                </div>
              </div>
              {pendingDebts.slice(0, 3).map(d => {
                const txnTags = d.txn_tags || []
                return (
                  <div key={d.id} className="flex items-center justify-between rounded-2xl px-3.5 py-3 gap-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{d.friends?.name}</p>
                      <p className="text-xs text-white/30 truncate">{d.transactions?.title}</p>
                      {txnTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {txnTags.map(t => <TagPill key={t.id} tag={t} small />)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-amber-300">{fmt(d.amount)}</span>
                      <button
                        onClick={() => settle(d.id)}
                        className="text-xs font-semibold text-emerald-400 px-3 py-2 rounded-xl active:scale-95 transition-all"
                        style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}
                      >✓</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Running EMIs ── */}
          {emis.length > 0 && (
            <div className="rounded-3xl p-4 space-y-2.5" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-violet-300">📋 Running EMIs</p>
                <button onClick={() => setShowEmis(true)} className="text-xs text-violet-300/50 hover:text-violet-300 transition-colors">Manage →</button>
              </div>
              {emis.map(emi => {
                const paid = getEmiProgress(emi)
                const paidNow = isEmiPaidThisMonth(emi)
                const remaining_months = emi.total_months - paid
                return (
                  <div key={emi.id} className="flex items-center justify-between rounded-2xl px-3.5 py-3 gap-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{emi.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-white/30">{fmt(emi.amount)}/mo · {paid}/{emi.total_months}</p>
                        {remaining_months > 0 && <p className="text-xs text-violet-300/50">{remaining_months} left</p>}
                        {remaining_months === 0 && <p className="text-xs text-emerald-400/70">Complete ✓</p>}
                      </div>
                      <div className="flex gap-0.5 mt-2 flex-wrap">
                        {Array.from({ length: emi.total_months }).map((_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full transition-all"
                            style={{ background: i < paid || (i === paid && paidNow) ? '#34d399' : 'rgba(255,255,255,0.1)' }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleEmiPay(emi)}
                      disabled={emiLoading === emi.id || remaining_months === 0}
                      className="shrink-0 text-xs font-semibold px-3 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40"
                      style={paidNow
                        ? { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }
                        : { background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', color: '#c4b5fd' }
                      }
                    >
                      {emiLoading === emi.id
                        ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block" />
                        : paidNow ? '✓ Paid' : 'Pay'
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
              <h2 className="font-bold text-base">
                Transactions
                {transactions.length > 0 && <span className="ml-2 text-xs text-white/20 font-normal">{transactions.length} this month</span>}
              </h2>
              <button
                onClick={() => { resetTxn(); setShowTxn(true) }}
                className="flex items-center gap-1.5 font-bold text-sm px-4 py-2.5 rounded-2xl transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', color: '#07070f', boxShadow: '0 4px 16px rgba(52,211,153,0.25)' }}
              >
                + Add
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="rounded-3xl p-12 flex flex-col items-center text-center" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
                <p className="text-3xl mb-3">💸</p>
                <p className="text-white/30 text-sm mb-3">No expenses this month</p>
                <button onClick={() => { resetTxn(); setShowTxn(true) }} className="text-sm text-emerald-400 hover:underline">Add your first →</button>
              </div>
            ) : (
              <div className="space-y-2">
                {(showAllTxns ? transactions : transactions.slice(0, 15)).map(t => {
                  const unsettled = t.debts?.filter(d => !d.is_settled) || []
                  const debtSum = unsettled.reduce((s, d) => s + Number(d.amount), 0)
                  const txnTags = t.txn_tags || []
                  const isEmiTxn = !!t.emi_id
                  const isCredit = Number(t.my_amount) < 0
                  const displayAmt = Math.abs(Number(t.my_amount))
                  return (
                    <div
                      key={t.id}
                      className="group flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-all"
                      style={{
                        background: isCredit ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.03)',
                        border: isCredit ? '1px solid rgba(52,211,153,0.12)' : '1px solid rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <div className="text-xl shrink-0 mt-0.5">
                        {isCredit ? '💰' : isEmiTxn ? '📋' : (CAT_ICON[t.category] || '📦')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="font-semibold text-sm text-white">{t.title}</p>
                          {isCredit && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>Collected</span>}
                          {isEmiTxn && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', color: '#c4b5fd' }}>EMI</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/30 mb-1.5">
                          <span>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          {!isCredit && t.total_amount !== t.my_amount && <span>paid {fmt(t.total_amount)}</span>}
                          {debtSum > 0 && <span className="text-amber-300/70">{unsettled.map(d => d.friends?.name).join(', ')} owe{unsettled.length === 1 ? 's' : ''} {fmt(debtSum)}</span>}
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
                          <p className="text-sm font-bold" style={{ color: isCredit ? '#34d399' : 'rgba(255,255,255,0.9)' }}>
                            {isCredit ? '+' : ''}{fmt(displayAmt)}
                          </p>
                          {!isCredit && t.total_amount !== t.my_amount && <p className="text-[10px] text-white/20">of {fmt(t.total_amount)}</p>}
                        </div>
                        {!isEmiTxn && !isCredit && (
                          <button
                            onClick={() => { if (window.confirm('Delete this transaction?')) deleteTransaction(t.id).then(load) }}
                            className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 text-xl transition-all leading-none mt-0.5"
                          >×</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {transactions.length > 15 && (
              <button
                onClick={() => setShowAllTxns(v => !v)}
                className="w-full mt-2 py-3 text-xs font-semibold text-white/40 hover:text-white/70 transition-all rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {showAllTxns ? '↑ Show less' : `${transactions.length - 15} more · Show all`}
              </button>
            )}
          </div>
        </>)}
      </main>

      {/* ══ MODAL: Budget ══ */}
      <Modal open={showBudget} onClose={() => setShowBudget(false)} title="Set Monthly Budget">
        <div className="space-y-4">
          <p className="text-sm text-white/40">Spending limit for {MONTHS[currentMonth - 1]} {currentYear}</p>
          <div>
            <label className={lCls}>Budget Amount (₹)</label>
            <input
              className={iCls}
              type="number"
              inputMode="numeric"
              placeholder="e.g. 15000"
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveBudget()}
              style={{ fontSize: '16px' }}
            />
          </div>
          <button onClick={saveBudget} className="w-full py-4 font-bold text-sm rounded-2xl transition-all active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', color: '#07070f', boxShadow: '0 4px 20px rgba(52,211,153,0.3)' }}>
            Save Budget
          </button>
        </div>
      </Modal>

      {/* ══ MODAL: Add Transaction ══ */}
      <Modal open={showTxn} onClose={() => { setShowTxn(false); resetTxn() }} title="Add Expense">
        <div className="space-y-4">
          <div>
            <label className={lCls}>Title *</label>
            <input className={iCls} type="text" placeholder="e.g. Dinner at Pizza Hut" value={txn.title} onChange={e => setTxn(f => ({ ...f, title: e.target.value }))} autoFocus style={{ fontSize: '16px' }} />
          </div>

          <div>
            <label className={lCls}>Total Amount (₹) *</label>
            <input className={iCls} type="number" inputMode="decimal" placeholder="0" value={txn.totalAmount} onChange={e => handleTotalChange(e.target.value)} style={{ fontSize: '16px' }} />
          </div>

          <div>
            <label className={lCls}>Date</label>
            <input className={iCls} type="date" value={txn.date} onChange={e => setTxn(f => ({ ...f, date: e.target.value }))} style={{ fontSize: '16px' }} />
          </div>

          {/* Tags */}
          <div>
            <label className={lCls}>Tags</label>
            <TagSelector allTags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} onCreateTag={handleCreateTag} />
          </div>

          {/* Split */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between">
              <p className={lCls} style={{ margin: 0 }}>Split with Friends</p>
              {friends.length > 0 ? (
                <button type="button" onClick={addSplit} className="text-xs font-semibold text-emerald-400 px-3 py-1.5 rounded-xl transition-all active:scale-95" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>+ Add</button>
              ) : (
                <button type="button" onClick={() => { setShowTxn(false); setShowFriends(true) }} className="text-xs text-white/30 hover:text-emerald-400 transition-colors">Add friends first →</button>
              )}
            </div>

            {splits.map((sp, i) => (
              <div key={i} className="space-y-2">
                <div className="flex gap-2 items-center">
                  <select className={`${sCls} flex-1`} value={sp.friendId} onChange={e => updateSplit(i, 'friendId', e.target.value)} style={{ fontSize: '16px' }}>
                    <option value="">Select friend</option>
                    {friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <input className={`${iCls} w-28`} type="number" inputMode="decimal" placeholder="₹ share" value={sp.amount} onChange={e => updateSplit(i, 'amount', e.target.value)} style={{ fontSize: '16px' }} />
                  <button onClick={() => removeSplit(i)} className="w-9 h-9 flex items-center justify-center text-white/25 hover:text-red-400 text-xl transition-colors rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>×</button>
                </div>
              </div>
            ))}

            {splits.length > 0 && (
              <div className="pt-2 border-t border-white/6">
                <label className={lCls}>My Share (auto)</label>
                <input
                  className={`${iCls}`}
                  type="number"
                  inputMode="decimal"
                  value={txn.myAmount}
                  onChange={e => setTxn(f => ({ ...f, myAmount: e.target.value }))}
                  placeholder="Auto"
                  style={{ fontSize: '16px', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.05)', color: '#6ee7b7' }}
                />
              </div>
            )}
          </div>

          <div>
            <label className={lCls}>Note (optional)</label>
            <input className={iCls} type="text" placeholder="Any details..." value={txn.note} onChange={e => setTxn(f => ({ ...f, note: e.target.value }))} style={{ fontSize: '16px' }} />
          </div>

          {txnErr && <div className="rounded-2xl px-4 py-3 text-sm text-red-400 font-medium" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>{txnErr}</div>}

          {txn.totalAmount && (
            <div className="rounded-2xl px-4 py-3 space-y-2 text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className={lCls} style={{ margin: '0 0 8px 0' }}>Summary</p>
              <div className="flex justify-between text-white/40"><span>Total paid</span><span className="text-white font-semibold">{fmt(txn.totalAmount || 0)}</span></div>
              <div className="flex justify-between text-white/40"><span>Your share</span><span className="text-emerald-400 font-semibold">{fmt(txn.myAmount || txn.totalAmount || 0)}</span></div>
              {splits.filter(s => s.amount && s.friendId).map((sp, i) => {
                const fr = friends.find(f => f.id === sp.friendId)
                return <div key={i} className="flex justify-between text-white/40"><span>{fr?.name || 'Friend'} owes</span><span className="text-amber-300 font-semibold">{fmt(sp.amount)}</span></div>
              })}
            </div>
          )}

          <button
            onClick={saveTxn}
            disabled={txnLoading}
            className="w-full py-4 font-bold text-sm rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', color: '#07070f', boxShadow: '0 4px 20px rgba(52,211,153,0.3)' }}
          >
            {txnLoading && <span className="w-4 h-4 border-2 border-[#07070f]/30 border-t-[#07070f] rounded-full animate-spin" />}
            Save Expense
          </button>
        </div>
      </Modal>

      {/* ══ MODAL: Tags ══ */}
      <Modal open={showTagMgr} onClose={() => setShowTagMgr(false)} title="🏷 Manage Tags">
        <div className="space-y-4">
          <p className="text-sm text-white/40">Tags help categorise and filter your expenses.</p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(t => <TagPill key={t.id} tag={t} onRemove={handleDeleteTag} />)}
            </div>
          )}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <TagSelector allTags={tags} selectedIds={[]} onChange={() => {}} onCreateTag={handleCreateTag} />
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: Friends ══ */}
      <Modal open={showFriends} onClose={() => setShowFriends(false)} title="👥 Friends">
        <div className="space-y-4">
          <div className="space-y-2">
            <input className={iCls} placeholder="Name *" value={fname} onChange={e => setFname(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveFriend()} style={{ fontSize: '16px' }} />
            <input className={iCls} placeholder="Email (optional)" value={femail} onChange={e => setFemail(e.target.value)} style={{ fontSize: '16px' }} />
            <button onClick={saveFriend} className="w-full py-3.5 font-bold text-sm rounded-2xl transition-all active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', color: '#07070f' }}>
              Add Friend
            </button>
          </div>
          {fErr && <p className="text-red-400 text-xs">{fErr}</p>}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {friends.length === 0 ? (
              <p className="text-center text-white/25 text-sm py-6">No friends added yet</p>
            ) : friends.map(f => {
              const owed = pendingDebts.filter(d => d.friend_id === f.id).reduce((s, d) => s + Number(d.amount), 0)
              return (
                <div key={f.id} className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{f.name}</p>
                      {f.email && <p className="text-xs text-white/30 truncate">{f.email}</p>}
                      {owed > 0 && <p className="text-xs text-amber-300 font-semibold">Owes {fmt(owed)}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { setShowFriends(false); setFriendDetail(f) }}
                        className="text-xs font-semibold text-emerald-400 px-2.5 py-2 rounded-xl transition-all active:scale-95"
                        style={{ background: 'rgba(52,211,153,0.1)' }}
                      >Debts</button>
                      {owed > 0 && (
                        <button
                          onClick={async () => { if (!window.confirm(`Collect from ${f.name}? (${fmt(owed)})`)) return; await settleAll(f.id) }}
                          className="text-xs font-semibold text-amber-300 px-2.5 py-2 rounded-xl transition-all active:scale-95"
                          style={{ background: 'rgba(251,191,36,0.1)' }}
                        >✓ All</button>
                      )}
                      <button onClick={() => removeFriend(f.id)} className="text-xs text-white/20 hover:text-red-400 transition-colors px-2">✕</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: All Pending Debts ══ */}
      <Modal open={showAllDebts} onClose={() => setShowAllDebts(false)} title="💳 Pending Debts">
        <div className="space-y-3">
          {pendingDebts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-white/30 text-sm">No pending debts!</p>
            </div>
          ) : (<>
            <div className="flex justify-between text-xs text-white/30 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span>{pendingDebts.length} pending</span>
              <span className="text-amber-300 font-semibold">{fmt(pendingTotal)} to collect</span>
            </div>
            {pendingDebts.map(d => {
              const txnTags = d.txn_tags || []
              return (
                <div key={d.id} className="flex items-start justify-between gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{d.friends?.name}</p>
                    <p className="text-xs text-white/30">{d.transactions?.title}</p>
                    <p className="text-xs text-white/20">{d.transactions?.date && new Date(d.transactions.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    {txnTags.length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{txnTags.map(t => <TagPill key={t.id} tag={t} small />)}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-base font-bold text-amber-300">{fmt(d.amount)}</span>
                    <button
                      onClick={() => settle(d.id)}
                      className="text-xs font-semibold text-emerald-400 px-3 py-2 rounded-xl transition-all active:scale-95"
                      style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}
                    >✓ Collected</button>
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

      {/* ══ MODAL: Winnings ══ */}
      <Modal open={showWinnings} onClose={() => setShowWinnings(false)} title="🎰 Slice Winnings">
        <div className="space-y-4">
          <p className="text-sm text-white/40">Add Slice winnings to boost your {MONTHS[currentMonth - 1]} budget.</p>
          <input className={iCls} placeholder="e.g. Weekend Slice win" value={winTitle} onChange={e => setWinTitle(e.target.value)} style={{ fontSize: '16px' }} />
          <input className={iCls} type="number" inputMode="decimal" placeholder="₹ Amount" value={winAmount} onChange={e => setWinAmount(e.target.value)} style={{ fontSize: '16px' }} />
          {winErr && <p className="text-red-400 text-xs">{winErr}</p>}
          <button onClick={saveWinning} className="w-full py-4 font-bold text-sm rounded-2xl transition-all active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', color: '#fff', boxShadow: '0 4px 20px rgba(139,92,246,0.3)' }}>
            + Add Winning
          </button>

          {winnings.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-3">No winnings added this month</p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/30 pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span>{winnings.length} entries</span>
                <span className="text-violet-300 font-semibold">Total: {fmt(totalWinnings)}</span>
              </div>
              {winnings.map(w => (
                <div key={w.id} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div>
                    <p className="text-sm font-semibold text-white">{w.title}</p>
                    <p className="text-xs text-white/30">{new Date(w.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-violet-300">+{fmt(w.amount)}</span>
                    <button onClick={() => removeWinning(w.id)} className="text-white/25 hover:text-red-400 transition-colors text-xl">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ══ MODAL: EMIs ══ */}
      <Modal open={showEmis} onClose={() => setShowEmis(false)} title="📋 Running EMIs">
        <div className="space-y-4">
          <p className="text-sm text-white/40">Track monthly installments. Mark each month as paid.</p>

          {/* Add form */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className={lCls}>New EMI</p>
            <input className={iCls} placeholder="e.g. iPhone 15 Pro, Bike loan" value={emiForm.title} onChange={e => setEmiForm(f => ({ ...f, title: e.target.value }))} style={{ fontSize: '16px' }} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>Monthly (₹)</label>
                <input className={iCls} type="number" inputMode="decimal" placeholder="2500" value={emiForm.amount} onChange={e => setEmiForm(f => ({ ...f, amount: e.target.value }))} style={{ fontSize: '16px' }} />
              </div>
              <div>
                <label className={lCls}>Months</label>
                <input className={iCls} type="number" inputMode="numeric" placeholder="12" value={emiForm.totalMonths} onChange={e => setEmiForm(f => ({ ...f, totalMonths: e.target.value }))} style={{ fontSize: '16px' }} />
              </div>
            </div>
            {emiErr && <p className="text-red-400 text-xs">{emiErr}</p>}
            <button onClick={saveEmi} className="w-full py-3.5 font-bold text-sm rounded-2xl transition-all active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', color: '#fff' }}>
              + Add EMI
            </button>
          </div>

          {emis.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-4">No running EMIs</p>
          ) : (
            <div className="space-y-3">
              {emis.map(emi => {
                const paid = getEmiProgress(emi)
                const paidNow = isEmiPaidThisMonth(emi)
                const remaining_months = emi.total_months - paid
                const totalLeft = remaining_months * Number(emi.amount)
                const payments = emi.emi_payments || []
                return (
                  <div key={emi.id} className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-white">{emi.title}</p>
                        <p className="text-xs text-white/35 mt-0.5">{fmt(emi.amount)}/mo · {emi.total_months} months</p>
                      </div>
                      <button onClick={() => removeEmi(emi.id)} className="text-white/20 hover:text-red-400 transition-colors text-xl w-8 h-8 flex items-center justify-center">×</button>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-white/30 mb-1.5">
                        <span>{paid}/{emi.total_months} paid</span>
                        <span>{remaining_months > 0 ? `${fmt(totalLeft)} left` : '🎉 Done!'}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((paid / emi.total_months) * 100, 100)}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: emi.total_months }).map((_, i) => {
                        const isPast = i < paid
                        const isCurrent = i === paid && paidNow
                        const isNext = i === paid && !paidNow
                        return (
                          <div
                            key={i}
                            title={`Month ${i + 1}`}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all"
                            style={{
                              background: isPast || isCurrent ? '#34d399' : isNext ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.07)',
                              color: isPast || isCurrent ? '#07070f' : isNext ? '#c4b5fd' : 'rgba(255,255,255,0.25)',
                              border: isNext ? '1px solid rgba(167,139,250,0.4)' : 'none',
                            }}
                          >
                            {i + 1}
                          </div>
                        )
                      })}
                    </div>

                    {payments.length > 0 && (
                      <div className="space-y-1 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">History</p>
                        {[...payments].sort((a, b) => b.year - a.year || b.month - a.month).map(p => (
                          <div key={p.id} className="flex justify-between text-xs text-white/35">
                            <span>{MONTHS[p.month - 1]} {p.year}</span>
                            <span style={{ color: 'rgba(52,211,153,0.6)' }}>{fmt(p.amount)} paid</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {remaining_months > 0 && (
                      <button
                        onClick={() => toggleEmiPay(emi)}
                        disabled={emiLoading === emi.id}
                        className="w-full py-3.5 text-sm font-bold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
                        style={paidNow
                          ? { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }
                          : { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd' }
                        }
                      >
                        {emiLoading === emi.id
                          ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          : paidNow
                            ? `✓ ${MONTHS[currentMonth - 1]} Paid — undo`
                            : `Mark ${MONTHS[currentMonth - 1]} Paid (${fmt(emi.amount)})`
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