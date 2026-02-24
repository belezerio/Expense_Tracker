import { supabase } from './supabaseClient'

const now = new Date()
export const currentMonth = now.getMonth() + 1
export const currentYear  = now.getFullYear()

// ─── Budget ──────────────────────────────────────────────────
export const getBudget = async (userId, month = currentMonth, year = currentYear) => {
  const { data, error } = await supabase
    .from('budgets').select('*')
    .eq('user_id', userId).eq('month', month).eq('year', year)
    .maybeSingle()
  return { data, error }
}

export const upsertBudget = async (userId, amount, month = currentMonth, year = currentYear) => {
  const { data, error } = await supabase
    .from('budgets')
    .upsert({ user_id: userId, month, year, amount }, { onConflict: 'user_id,month,year' })
    .select().single()
  return { data, error }
}

// ─── Tags ────────────────────────────────────────────────────
export const getTags = async (userId) => {
  const { data, error } = await supabase
    .from('tags').select('*').eq('user_id', userId).order('name')
  return { data: data ?? [], error }
}

export const createTag = async (userId, name, color = '#6ee7b7') => {
  const { data, error } = await supabase
    .from('tags').insert({ user_id: userId, name: name.trim(), color })
    .select().single()
  return { data, error }
}

export const deleteTag = async (id) => {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  return { error }
}

// ─── Friends ─────────────────────────────────────────────────
export const getFriends = async (userId) => {
  const { data, error } = await supabase
    .from('friends').select('*').eq('user_id', userId).order('name')
  return { data: data ?? [], error }
}

export const addFriend = async (userId, name, email = '') => {
  const { data, error } = await supabase
    .from('friends').insert({ user_id: userId, name, email })
    .select().single()
  return { data, error }
}

export const deleteFriend = async (id) => {
  const { error } = await supabase.from('friends').delete().eq('id', id)
  return { error }
}

// Full debt history for one friend (all time, settled + pending)
export const getFriendDebts = async (userId, friendId) => {
  const { data, error } = await supabase
    .from('debts')
    .select('*, transactions( id, title, date, total_amount, my_amount, note )')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error }

  // Fetch tags separately
  let tagMap = {}
  try {
    const txnIds = [...new Set((data ?? []).map(d => d.transaction_id).filter(Boolean))]
    if (txnIds.length > 0) {
      const { data: ttRows } = await supabase
        .from('transaction_tags')
        .select('transaction_id, tags( id, name, color )')
        .in('transaction_id', txnIds)
      ;(ttRows ?? []).forEach(row => {
        if (!tagMap[row.transaction_id]) tagMap[row.transaction_id] = []
        if (row.tags) tagMap[row.transaction_id].push(row.tags)
      })
    }
  } catch (_) {}

  return {
    data: (data ?? []).map(d => ({ ...d, txn_tags: tagMap[d.transaction_id] ?? [] })),
    error: null,
  }
}

// ─── Transactions ────────────────────────────────────────────
export const getTransactions = async (userId, month = currentMonth, year = currentYear) => {
  // 1. Fetch transactions + debts
  const { data: txns, error } = await supabase
    .from('transactions')
    .select('*, debts( *, friends( id, name ) )')
    .eq('user_id', userId).eq('month', month).eq('year', year)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error }

  // 2. Fetch tags for each transaction (separate query — safe if table missing)
  let tagMap = {}
  try {
    const ids = (txns ?? []).map(t => t.id)
    if (ids.length > 0) {
      const { data: ttRows } = await supabase
        .from('transaction_tags')
        .select('transaction_id, tags( id, name, color )')
        .in('transaction_id', ids)
      ;(ttRows ?? []).forEach(row => {
        if (!tagMap[row.transaction_id]) tagMap[row.transaction_id] = []
        if (row.tags) tagMap[row.transaction_id].push(row.tags)
      })
    }
  } catch (_) {
    // table doesn't exist yet — tags just won't show
  }

  const data = (txns ?? []).map(t => ({
    ...t,
    txn_tags: tagMap[t.id] ?? [],
  }))

  return { data, error: null }
}

export const addTransaction = async (userId, txn, tagIds = []) => {
  const { data: saved, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      title: txn.title,
      total_amount: txn.totalAmount,
      my_amount: txn.myAmount,
      category: txn.category || 'General',
      note: txn.note || '',
      date: txn.date || new Date().toISOString().slice(0, 10),
      month: txn.month || currentMonth,
      year: txn.year || currentYear,
      ...(txn.emi_id ? { emi_id: txn.emi_id } : {}),
    })
    .select().single()

  if (error || !saved) return { data: saved, error }

  if (tagIds.length > 0) {
    await supabase.from('transaction_tags').insert(
      tagIds.map(tag_id => ({ transaction_id: saved.id, tag_id }))
    )
  }

  return { data: saved, error: null }
}

export const deleteTransaction = async (id) => {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  return { error }
}

// ─── Debts ───────────────────────────────────────────────────
export const addDebts = async (debts) => {
  if (!debts.length) return { error: null }
  const { error } = await supabase.from('debts').insert(debts)
  return { error }
}

export const getPendingDebts = async (userId) => {
  const { data, error } = await supabase
    .from('debts')
    .select('*, friends( id, name, email ), transactions( id, title, date )')
    .eq('user_id', userId).eq('is_settled', false)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error }

  let tagMap = {}
  try {
    const txnIds = [...new Set((data ?? []).map(d => d.transaction_id).filter(Boolean))]
    if (txnIds.length > 0) {
      const { data: ttRows } = await supabase
        .from('transaction_tags')
        .select('transaction_id, tags( id, name, color )')
        .in('transaction_id', txnIds)
      ;(ttRows ?? []).forEach(row => {
        if (!tagMap[row.transaction_id]) tagMap[row.transaction_id] = []
        if (row.tags) tagMap[row.transaction_id].push(row.tags)
      })
    }
  } catch (_) {}

  const enriched = (data ?? []).map(d => ({
    ...d,
    txn_tags: tagMap[d.transaction_id] ?? [],
  }))

  return { data: enriched, error: null }
}

export const settleDebt = async (debtId) => {
  // 1. Fetch the debt with friend + transaction info
  const { data: debt, error: fetchError } = await supabase
    .from('debts')
    .select('*, friends( name ), transactions( title )')
    .eq('id', debtId)
    .single()
  if (fetchError) return { data: null, error: fetchError }

  // 2. Mark as settled
  const { data, error } = await supabase
    .from('debts')
    .update({ is_settled: true, settled_at: new Date().toISOString() })
    .eq('id', debtId).select().single()
  if (error) return { data: null, error }

  // 3. Insert a credit transaction (negative my_amount = money coming back in)
  await supabase.from('transactions').insert({
    user_id: debt.user_id,
    title: `Collected: ${debt.friends?.name} — ${debt.transactions?.title}`,
    total_amount: Number(debt.amount),
    my_amount: -Number(debt.amount),
    category: 'General',
    note: 'Debt collected',
    date: new Date().toISOString().slice(0, 10),
    month: currentMonth,
    year: currentYear,
  })

  return { data, error: null }
}

// Settle ALL pending debts for a specific friend at once
export const settleAllFriendDebts = async (userId, friendId) => {
  // 1. Fetch all pending debts for this friend with context
  const { data: debts, error: fetchError } = await supabase
    .from('debts')
    .select('*, friends( name ), transactions( title )')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .eq('is_settled', false)
  if (fetchError) return { data: null, error: fetchError }

  // 2. Mark all as settled
  const { data, error } = await supabase
    .from('debts')
    .update({ is_settled: true, settled_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .eq('is_settled', false)
    .select()
  if (error) return { data: null, error }

  // 3. Insert one combined credit transaction for the total
  if (debts && debts.length > 0) {
    const totalAmount = debts.reduce((s, d) => s + Number(d.amount), 0)
    const friendName = debts[0].friends?.name || 'Friend'
    await supabase.from('transactions').insert({
      user_id: userId,
      title: `Collected: ${friendName} (${debts.length} debt${debts.length > 1 ? 's' : ''})`,
      total_amount: totalAmount,
      my_amount: -totalAmount,
      category: 'General',
      note: 'All debts collected',
      date: new Date().toISOString().slice(0, 10),
      month: currentMonth,
      year: currentYear,
    })
  }

  return { data, error: null }
}

// ─── Winnings ────────────────────────────────────────────────
export const getWinnings = async (userId, month = currentMonth, year = currentYear) => {
  const { data, error } = await supabase
    .from('winnings').select('*')
    .eq('user_id', userId).eq('month', month).eq('year', year)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export const addWinning = async (userId, title, amount) => {
  const { data, error } = await supabase
    .from('winnings')
    .insert({ user_id: userId, title, amount, month: currentMonth, year: currentYear })
    .select().single()
  return { data, error }
}

export const deleteWinning = async (id) => {
  const { error } = await supabase.from('winnings').delete().eq('id', id)
  return { error }
}

// ─── EMIs ────────────────────────────────────────────────────
export const getEmis = async (userId) => {
  const { data, error } = await supabase
    .from('emis').select('*, emi_payments(*)')
    .eq('user_id', userId).eq('is_active', true)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export const addEmi = async (userId, title, amount, totalMonths, startMonth = currentMonth, startYear = currentYear) => {
  const { data, error } = await supabase
    .from('emis')
    .insert({ user_id: userId, title, amount, total_months: totalMonths, start_month: startMonth, start_year: startYear })
    .select().single()
  return { data, error }
}

export const deleteEmi = async (id) => {
  const { error } = await supabase.from('emis').delete().eq('id', id)
  return { error }
}

// Mark this month's EMI as paid — also creates a transaction for it
export const payEmi = async (userId, emiId, amount, emiTitle, month = currentMonth, year = currentYear) => {
  // 1. Upsert the emi_payment record
  const { data: payment, error: payError } = await supabase
    .from('emi_payments')
    .upsert(
      { user_id: userId, emi_id: emiId, month, year, amount },
      { onConflict: 'emi_id,month,year' }
    )
    .select().single()

  if (payError) return { data: null, error: payError }

  // 2. Insert a transaction so it shows up in the expense list
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      title: `EMI: ${emiTitle}`,
      total_amount: amount,
      my_amount: amount,
      category: 'Bills',
      note: `EMI payment for ${MONTHS[month - 1]} ${year}`,
      date: new Date().toISOString().slice(0, 10),
      month,
      year,
      emi_id: emiId,
    })
    .select().single()

  if (txnError) {
    // Roll back the payment if transaction insert fails
    await supabase.from('emi_payments').delete()
      .eq('emi_id', emiId).eq('month', month).eq('year', year)
    return { data: null, error: txnError }
  }

  return { data: { payment, txn }, error: null }
}

// Un-pay this month's EMI — also deletes the linked transaction
export const unpayEmi = async (emiId, month = currentMonth, year = currentYear) => {
  // 1. Delete the linked transaction for this emi + month + year
  await supabase
    .from('transactions')
    .delete()
    .eq('emi_id', emiId)
    .eq('month', month)
    .eq('year', year)

  // 2. Delete the emi_payment record
  const { error } = await supabase
    .from('emi_payments')
    .delete()
    .eq('emi_id', emiId).eq('month', month).eq('year', year)

  return { error }
}