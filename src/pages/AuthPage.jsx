import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AuthPage = () => {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(formData.email, formData.password)
        if (error) throw error
        navigate('/dashboard')
      } else if (mode === 'signup') {
        if (formData.password !== formData.confirmPassword) throw new Error('Passwords do not match')
        if (formData.password.length < 6) throw new Error('Password must be at least 6 characters')
        const { error } = await signUp(formData.email, formData.password, formData.fullName)
        if (error) throw error
        setMessage('Account created! You can now sign in.')
      } else {
        const { error } = await resetPassword(formData.email)
        if (error) throw error
        setMessage('Password reset link sent to your email!')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { setError(error.message); setLoading(false) }
  }

  const switchMode = (m) => { setMode(m); setError(''); setMessage('') }

  const inputCls = `
    w-full rounded-2xl px-4 py-3.5 text-sm text-white
    placeholder-white/25 outline-none transition-all
    caret-emerald-400
  `

  return (
    <div
      className="min-h-screen flex text-white relative overflow-hidden"
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: 'linear-gradient(160deg, #07070f 0%, #0d0d1c 40%, #080812 100%)',
        minHeight: '100dvh',
      }}
    >
      {/* ── Ambient orbs ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '70vw', height: '70vw', maxWidth: 600, maxHeight: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 65%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '55vw', height: '55vw', maxWidth: 500, maxHeight: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 65%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '40%', width: '40vw', height: '40vw', maxWidth: 350, maxHeight: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.03) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      {/* ── Left Panel (desktop only) ── */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 p-14 relative overflow-hidden"
        style={{
          borderRight: '1px solid rgba(255,255,255,0.05)',
          background: 'linear-gradient(160deg, rgba(12,16,24,0.8) 0%, rgba(8,10,18,0.9) 100%)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl"
            style={{ background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)', color: '#07070f', boxShadow: '0 6px 24px rgba(52,211,153,0.35)' }}
          >₹</div>
          <span className="text-xl font-bold tracking-tight">Spendly</span>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h1 className="text-5xl xl:text-6xl font-black leading-[1.05] text-white/90 mb-6" style={{ letterSpacing: '-0.03em' }}>
            Track every<br />
            <span
              className="italic"
              style={{
                background: 'linear-gradient(135deg, #34d399 0%, #6ee7b7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >rupee.</span>
          </h1>
          <p className="text-white/35 text-base leading-relaxed max-w-xs">
            Smart expense tracking that shows you where your money goes — and where it should.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['Split bills', 'Track EMIs', 'Friend debts', 'Tag expenses'].map(f => (
              <span
                key={f}
                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', color: 'rgba(110,231,183,0.8)' }}
              >{f}</span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-10 relative z-10">
          {[['₹15k+', 'Tracked'], ['4.9★', 'Rating'], ['100%', 'Private']].map(([val, label], i) => (
            <div key={i} className="flex items-center gap-10">
              <div className="flex flex-col gap-1">
                <strong className="text-2xl font-black" style={{ background: 'linear-gradient(135deg, #34d399, #6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{val}</strong>
                <span className="text-white/30 text-[10px] uppercase tracking-[0.2em] font-semibold">{label}</span>
              </div>
              {i < 2 && <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.08)' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel / Auth Form ── */}
      <div className="relative z-10 flex-1 lg:max-w-[480px] flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-sm">

          {/* Mobile brand */}
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg"
              style={{ background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)', color: '#07070f', boxShadow: '0 4px 16px rgba(52,211,153,0.3)' }}
            >₹</div>
            <span className="text-lg font-bold tracking-tight">Spendly</span>
          </div>

          {/* Glass card */}
          <div
            className="rounded-3xl p-6 sm:p-7"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >

            {/* Mode Tabs */}
            {mode !== 'forgot' && (
              <div
                className="flex p-1 rounded-2xl mb-6"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {[['login', 'Sign In'], ['signup', 'Sign Up']].map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={mode === m
                      ? { background: 'rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }
                      : { color: 'rgba(255,255,255,0.35)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Forgot Password Header */}
            {mode === 'forgot' && (
              <div className="mb-6">
                <button
                  onClick={() => switchMode('login')}
                  className="text-emerald-400 text-sm mb-5 flex items-center gap-1.5 font-semibold hover:opacity-70 transition-opacity"
                >
                  ← Back to Sign In
                </button>
                <h2 className="text-2xl font-black mb-1" style={{ letterSpacing: '-0.02em' }}>Reset Password</h2>
                <p className="text-white/35 text-sm">We'll send a reset link to your email</p>
              </div>
            )}

            {/* Login/Signup title */}
            {mode !== 'forgot' && (
              <div className="mb-6">
                <h2 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>
                  {mode === 'login' ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="text-white/35 text-sm mt-1">
                  {mode === 'login' ? 'Sign in to your Spendly account' : 'Start tracking your expenses'}
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">

              {mode === 'signup' && (
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mb-2 block">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                    className={inputCls}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '16px',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(52,211,153,0.5)'; e.target.style.background = 'rgba(52,211,153,0.04)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mb-2 block">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  inputMode="email"
                  className={inputCls}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '16px',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(52,211,153,0.5)'; e.target.style.background = 'rgba(52,211,153,0.04)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-emerald-400 text-xs font-semibold hover:opacity-70 transition-opacity"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      name="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className={`${inputCls} pr-12`}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '16px',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(52,211,153,0.5)'; e.target.style.background = 'rgba(52,211,153,0.04)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl text-white/30 hover:text-white/60 transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mb-2 block">Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    className={inputCls}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '16px',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(52,211,153,0.5)'; e.target.style.background = 'rgba(52,211,153,0.04)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                  />
                </div>
              )}

              {/* Error / Success */}
              {error && (
                <div
                  className="rounded-2xl px-4 py-3 text-sm leading-snug font-medium"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
                >
                  {error}
                </div>
              )}
              {message && (
                <div
                  className="rounded-2xl px-4 py-3 text-sm leading-snug font-medium"
                  style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}
                >
                  {message}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full py-4 font-bold text-sm rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                  color: '#07070f',
                  boxShadow: '0 6px 24px rgba(52,211,153,0.3)',
                  fontSize: '15px',
                }}
              >
                {loading && <span className="w-4 h-4 border-2 border-[#07070f]/30 border-t-[#07070f] rounded-full animate-spin" />}
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'forgot' && 'Send Reset Link'}
              </button>
            </form>

            {/* Google */}
            {mode !== 'forgot' && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <span className="text-white/25 text-xs font-medium">or continue with</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                </div>

                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full py-3.5 text-sm font-semibold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.8)',
                  }}
                  onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.09)'; e.target.style.borderColor = 'rgba(255,255,255,0.18)' }}
                  onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}
          </div>

          {/* Footer note */}
          <p className="text-center text-white/20 text-xs mt-5 leading-relaxed">
            By continuing, you agree to our{' '}
            <span className="text-emerald-400/60 hover:text-emerald-400 cursor-pointer transition-colors">Terms</span>
            {' '}&amp;{' '}
            <span className="text-emerald-400/60 hover:text-emerald-400 cursor-pointer transition-colors">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthPage