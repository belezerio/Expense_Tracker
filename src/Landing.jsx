import React, { useState } from 'react';
// import { useAuth } from '../AuthContext';
// import { generateUniqueId } from '../supabaseClient';
import { Heart, Mail, Lock, User, Phone, ChevronDown } from 'lucide-react';

function InputField({ icon, placeholder, value, onChange, type = 'text', autoComplete, onKeyPress }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`flex items-center bg-white border-[1.5px] rounded-[10px] px-3.5 py-[11px] gap-2.5 mb-[11px] transition-colors ${
      focused ? 'border-[#1a8a9a]' : 'border-[#d1dfe8]'
    }`}>
      {icon}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyPress={onKeyPress}
        className="border-none outline-none flex-1 text-sm text-[#2c3e50] bg-transparent font-inherit min-w-0"
      />
    </div>
  );
}

function LoginView({ onSwitchToSignUp }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 3500);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showMsg('error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { data, error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      let friendlyMsg = error.message || 'Login failed.';
      if (friendlyMsg.includes('Invalid login credentials')) {
        friendlyMsg = 'Email or password is incorrect. Please try again.';
      }
      showMsg('error', friendlyMsg);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) handleLogin();
  };

  return (
    <>
      {msg.text && (
        <div className={`rounded-[9px] px-3.5 py-2.5 text-[13px] font-semibold mb-4 text-center leading-snug ${
          msg.type === 'success'
            ? 'bg-[#d4edda] text-[#155724] border border-[#c3e6cb]'
            : 'bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb]'
        }`}>
          {msg.text}
        </div>
      )}

      <h2 className="text-xl font-bold text-[#1e3a4a] text-center m-0 mb-[22px]">
        Welcome Back
      </h2>

      <InputField
        icon={<Mail size={18} color="#8fa8b8" />}
        placeholder="Email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
        type="email"
        autoComplete="email"
        onKeyPress={handleKeyPress}
      />

      <InputField
        icon={<Lock size={18} color="#8fa8b8" />}
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        type="password"
        autoComplete="current-password"
        onKeyPress={handleKeyPress}
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        className={`w-full bg-gradient-to-br from-[#1a8a9a] to-[#0d7a8a] text-white border-none rounded-[9px] py-3 text-[15px] font-semibold cursor-pointer tracking-wide shadow-[0_2px_10px_rgba(13,122,138,0.3)] font-inherit mt-1 transition-opacity ${
          loading ? 'opacity-55 cursor-not-allowed' : ''
        }`}
      >
        {loading ? 'Logging in…' : 'Login'}
      </button>

      <p className="block text-center mt-[18px] text-[13.5px] text-[#7a9aaa] cursor-pointer bg-transparent border-none font-inherit p-0">
        Don't have an account?{' '}
        <span className="text-[#1a8a9a] font-semibold cursor-pointer" onClick={onSwitchToSignUp}>
          Sign Up
        </span>
      </p>
    </>
  );
}

function SignUpView({ onSwitchToLogin }) {
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const roleOptions = [
    { value: 'hospital',  label: 'Hospital'    },
    { value: 'doctor',    label: 'Doctor'       },
    { value: 'lab',       label: 'Laboratory'   },
    { value: 'pharmacy',  label: 'Pharmacy'     }, // ← NEW
    { value: 'patient',   label: 'Patient'      },
  ];

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !role) {
      showMsg('error', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      showMsg('error', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    const uniqueId = generateUniqueId(role);

    const { data, error } = await signUp(email.trim(), password, {
      name: name.trim(),
      role,
      phone: phone.trim() || null,
      uniqueId,
    });

    setLoading(false);

    if (error) {
      let friendlyMsg = error.message || 'Sign up failed.';
      if (friendlyMsg.includes('already exists') || friendlyMsg.includes('already registered')) {
        friendlyMsg = 'This email is already registered. Please log in instead.';
      }
      showMsg('error', friendlyMsg);
    } else {
      showMsg('success', `Account created! Your ID is ${uniqueId}. Please log in.`);
      setTimeout(() => {
        setName(''); setEmail(''); setPassword(''); setPhone(''); setRole('');
        onSwitchToLogin();
      }, 3500);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) handleSignUp();
  };

  return (
    <>
      {msg.text && (
        <div className={`rounded-[9px] px-3.5 py-2.5 text-[13px] font-semibold mb-4 text-center leading-snug ${
          msg.type === 'success'
            ? 'bg-[#d4edda] text-[#155724] border border-[#c3e6cb]'
            : 'bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb]'
        }`}>
          {msg.text}
        </div>
      )}

      <h2 className="text-xl font-bold text-[#1e3a4a] text-center m-0 mb-[22px]">
        Create Account
      </h2>

      <InputField
        icon={<User size={18} color="#8fa8b8" />}
        placeholder="Full name"
        value={name}
        onChange={e => setName(e.target.value)}
        autoComplete="name"
        onKeyPress={handleKeyPress}
      />

      <InputField
        icon={<Mail size={18} color="#8fa8b8" />}
        placeholder="Email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
        type="email"
        autoComplete="email"
        onKeyPress={handleKeyPress}
      />

      <InputField
        icon={<Lock size={18} color="#8fa8b8" />}
        placeholder="Password (min 6 chars)"
        value={password}
        onChange={e => setPassword(e.target.value)}
        type="password"
        autoComplete="new-password"
        onKeyPress={handleKeyPress}
      />

      <InputField
        icon={<Phone size={18} color="#8fa8b8" />}
        placeholder="Phone (optional)"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        type="tel"
        autoComplete="tel"
        onKeyPress={handleKeyPress}
      />

      {/* Role dropdown */}
      <div className="relative mb-[11px]">
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className={`w-full appearance-none bg-white border-[1.5px] border-[#d1dfe8] rounded-[10px] px-3.5 py-[11px] pr-9 text-sm font-inherit cursor-pointer outline-none ${
            role ? 'text-[#2c3e50]' : 'text-[#8fa8b8]'
          }`}
        >
          <option value="" disabled>Select your role</option>
          {roleOptions.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex">
          <ChevronDown size={16} color="#8fa8b8" strokeWidth={2.5} />
        </span>
      </div>

      <button
        onClick={handleSignUp}
        disabled={loading}
        className={`w-full bg-gradient-to-br from-[#1a8a9a] to-[#0d7a8a] text-white border-none rounded-[9px] py-3 text-[15px] font-semibold cursor-pointer tracking-wide shadow-[0_2px_10px_rgba(13,122,138,0.3)] font-inherit mt-1 transition-opacity ${
          loading ? 'opacity-55 cursor-not-allowed' : ''
        }`}
      >
        {loading ? 'Creating account…' : 'Sign Up'}
      </button>

      <p className="block text-center mt-[18px] text-[13.5px] text-[#7a9aaa] cursor-pointer bg-transparent border-none font-inherit p-0">
        Already have an account?{' '}
        <span className="text-[#1a8a9a] font-semibold cursor-pointer" onClick={onSwitchToLogin}>
          Login
        </span>
      </p>
    </>
  );
}

export default function LoginPage() {
  const [view, setView] = useState('login');

  return (
    <div className="min-h-screen bg-[#f0f7f9] font-['Segoe_UI',system-ui,sans-serif] flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2.5 mb-1.5">
        <Heart size={26} fill="#1a8a9a" stroke="#1a8a9a" strokeWidth={1.5} />
        <h1 className="text-[26px] font-bold text-[#1a8a9a] tracking-tight m-0">
          HealthBridg
        </h1>
      </div>
      <p className="text-center text-[13px] text-[#7a9aaa] mb-6 mt-0.5">
        {view === 'login' ? 'Sign in to manage your hospital' : 'Join the HealthBridg network'}
      </p>

      {/* Card */}
      <div className="bg-[#eaf4f7] rounded-[18px] px-6 py-8 w-full max-w-[400px] shadow-[0_4px_24px_rgba(26,138,154,0.08)]">
        {view === 'login' ? (
          <LoginView onSwitchToSignUp={() => setView('signup')} />
        ) : (
          <SignUpView onSwitchToLogin={() => setView('login')} />
        )}
      </div>
    </div>
  );
}