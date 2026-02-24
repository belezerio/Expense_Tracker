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
        setMessage('Check your email for a confirmation link!')
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

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-emerald-400/60 focus:bg-emerald-400/5 transition-all duration-200"

  return (
    <div className="min-h-screen flex bg-[#09090f] text-white">

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex flex-col justify-between flex-1 p-12 bg-[#0d0d14] border-r border-white/5 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        {/* Brand */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-emerald-400 rounded-xl flex items-center justify-center text-[#09090f] font-bold text-xl">₹</div>
          <span className="text-xl font-semibold tracking-tight">Spendly</span>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h1 className="text-5xl leading-[1.1] text-white/90 mb-5" style={{ fontFamily: 'Georgia, serif' }}>
            Track every<br />
            <span className="text-emerald-400 italic">rupee.</span>
          </h1>
          <p className="text-white/40 text-base leading-relaxed max-w-xs">
            Smart expense tracking that shows you where your money goes — and where it should.
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-8 relative z-10">
          {[['1+', 'Users'], ['₹15000+', 'Tracked'], ['4.9★', 'Rating']].map(([val, label], i) => (
            <div key={i} className="flex items-center gap-8">
              <div className="flex flex-col gap-0.5">
                <strong className="text-emerald-400 text-2xl font-semibold">{val}</strong>
                <span className="text-white/35 text-xs uppercase tracking-widest">{label}</span>
              </div>
              {i < 2 && <div className="w-px h-8 bg-white/10" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 lg:max-w-[480px] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mode Tabs */}
          {mode !== 'forgot' && (
            <div className="flex bg-white/5 rounded-xl p-1 mb-8">
              {[['login', 'Sign In'], ['signup', 'Sign Up']].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    mode === m ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Forgot Password Header */}
          {mode === 'forgot' && (
            <div className="mb-8">
              <button
                onClick={() => switchMode('login')}
                className="text-emerald-400 text-sm mb-5 flex items-center gap-1 hover:opacity-70 transition-opacity"
              >
                ← Back to Sign In
              </button>
              <h2 className="text-2xl font-semibold mb-1">Reset Password</h2>
              <p className="text-white/40 text-sm">We'll send a reset link to your email</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Email</label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className={inputCls}
              />
            </div>

            {mode !== 'forgot' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-emerald-400 text-xs hover:underline"
                    >
                      Forgot password?
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
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-sm"
                  >
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3 leading-snug">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm rounded-xl px-4 py-3 leading-snug">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3 bg-emerald-400 hover:bg-emerald-300 active:scale-[.98] text-[#09090f] font-semibold text-sm rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-[#09090f]/30 border-t-[#09090f] rounded-full animate-spin" />
              )}
              {mode === 'login' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot' && 'Send Reset Link'}
            </button>
          </form>

          {/* Google */}
          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/25 text-xs">or continue with</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  )
}

export default AuthPage