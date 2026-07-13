import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Mail, Lock, AlertCircle, User, Users, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { UserRole, Category } from '../types';
import { mergeUserWithStoredMeta } from '../utils/userMeta.ts';

type FormMode = 'login' | 'signup';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();
  const [mode, setMode] = useState<FormMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [selectedInterests, setSelectedInterests] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved email on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Official university email domains
  const VALID_DOMAINS = ['@university.edu', '@uni.edu', '@student.university.edu', '@staff.university.edu'];

  const validateEmail = (email: string): boolean => {
    const emailLower = email.toLowerCase();
    return VALID_DOMAINS.some(domain => emailLower.endsWith(domain));
  };
  const isValidPassword = (pass: string) => {
  return pass.length >= 6 && /[A-Z]/.test(pass);
};


  const categoryOptions: { value: Category; label: string; color: string }[] = [
    { value: 'campus-events-general', label: 'Campus Events', color: 'blue' },
    { value: 'jobs-internships-tech', label: 'Jobs & Internships', color: 'green' },
    { value: 'academics-datascience', label: 'Academics', color: 'purple' },
    { value: 'research-stem', label: 'Research', color: 'orange' },
    { value: 'announcements-admin', label: 'Announcements', color: 'red' }
  ];

  const toggleInterest = (category: Category) => {
    setSelectedInterests(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
//   const handleLogin = async (e: React.FormEvent) => {
//   e.preventDefault();
//   setError('');

//   if (!email) {
//     setError("Email is required");
//     return;
//   }

//   if (!password || password.length < 6) {
//     setError("Password must be at least 6 characters");
//     return;
//   }

//   try {
//     const res = await fetch("http://localhost:8000/api/login/", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         email,
//         password,
//       }),
//     });

//     const data = await res.json();

//     if (data.success) {
//       const user = {
//         id: data.user.id,
//         firstName: data.user.firstName,
//         lastName: data.user.lastName,
//         name: data.user.firstName + " " + data.user.lastName,
//         email: data.user.email,
//         role: data.user.role,
//         interests: [],
//         followedTopics: []
//       };

//       setCurrentUser(user);

//       if (data.user.role === "admin") {
//         navigate("/admin-dashboard");
//       } else {
//         navigate("/");
//       }

//     } else {
//       setError("Invalid email or password");
//     }

//   } catch (err) {
//     console.error(err);
//     setError("Server error");
//   }
// };
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setStatusMessage('');

  try {
    const res = await fetch("http://localhost:8000/api/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await res.json();

    if (data.success) {
      const user = mergeUserWithStoredMeta({
        ...data.user,
        name: data.user.name || `${data.user.firstName} ${data.user.lastName}`,
        followedTopics: data.user.followedTopics || [],
      });

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', user.email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      setCurrentUser(user);

      if (data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }

    } else {
      // ✅ FIXED HERE (ONLY CHANGE)
      if (data.message) {
        setError(data.message);
      } else {
        setError("Invalid email or password");
      }
    }

  } catch (err) {
    console.error(err);
    setError("Server error");
  }
};
  // const handleLogin = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setError('');

  //   // Validate email domain
  //   if (!validateEmail(email)) {
  //     setError('Please use your official university email address (e.g., name@university.edu)');
  //     return;
  //   }

  //   if (!password) {
  //     setError('Please enter your password');
  //     return;
  //   }

  //   // Find user in mock data
  //   let user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
  //   if (!user) {
  //     setError('Invalid email or password. Please try signing up first.');
  //     return;
  //   }

  //   // Handle remember me functionality
  //   if (rememberMe) {
  //     localStorage.setItem('rememberedEmail', email);
  //   } else {
  //     localStorage.removeItem('rememberedEmail');
  //   }

  //   setCurrentUser(user);
  //   navigate('/');
  // };

  const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setStatusMessage('');

  if (!firstName || !lastName || !email || !password) {
    setError("Please fill all required fields");
    return;
  }

  if (selectedRole === 'student' && selectedInterests.length === 0) {
    setError("Please choose at least one interest");
    return;
  }

  // ✅ PASSWORD VALIDATION
  if (!isValidPassword(password)) {
    setError("Password must be at least 6 characters and include 1 uppercase letter");
    return;
  }

  try {
    const res = await fetch("http://localhost:8000/api/signup/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        role: selectedRole,
        department: department.trim(),
        interests: selectedInterests
      }),
    });

    const data = await res.json();

    console.log("SIGNUP RESPONSE:", data);

    if (data.success) {

      if (data.faculty_request) {
        setMode('login');
        setPassword('');
        setStatusMessage("Faculty signup request sent to admin. You can log in after admin approval.");
        return;
      }

      // ✅ NORMAL STUDENT FLOW
      const user = mergeUserWithStoredMeta({
        ...data.user,
        role: data.user.role || selectedRole,
        department: department.trim() || undefined,
        interests: selectedInterests,
        followedTopics: data.user.followedTopics || []
      });

      setCurrentUser(user);
      navigate("/");

    } else {
      setError(data.message || "User already exists");
    }

  } catch (err) {
    console.error(err);
    setError("Server error");
  }
};
  // const handleSignup = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setError('');

  //   // Validate email domain
  //   if (!validateEmail(email)) {
  //     setError('Please use your official university email address (e.g., name@university.edu)');
  //     return;
  //   }

  //   if (!firstName.trim() || !lastName.trim()) {
  //     setError('Please enter your full name');
  //     return;
  //   }

  //   if (!password || password.length < 6) {
  //     setError('Password must be at least 6 characters');
  //     return;
  //   }

  //   if (selectedInterests.length === 0) {
  //     setError('Please select at least one interest to personalize your feed');
  //     return;
  //   }

  //   // Check if user already exists
  //   const existingUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  //   if (existingUser) {
  //     setError('An account with this email already exists. Please login instead.');
  //     return;
  //   }

  //   // Create new user
  //   const newUser = {
  //     id: `user${Date.now()}`,
  //     firstName: firstName.trim(),
  //     lastName: lastName.trim(),
  //     name: `${firstName.trim()} ${lastName.trim()}`,
  //     email: email.toLowerCase(),
  //     phoneNumber: '',
  //     role: selectedRole,
  //     department: department.trim() || undefined,
  //     interests: selectedInterests,
  //     followedTopics: []
  //   };

  //   // Add to mock users
  //   mockUsers.push(newUser);
    
  //   setCurrentUser(newUser);
  //   navigate('/');
  // };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email domain
    if (!validateEmail(forgotEmail)) {
      setError('Please use your official university email address (e.g., name@university.edu)');
      return;
    }

    // Simulate sending a password reset email
    setResetSent(true);
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="rounded-[2rem] border border-white/70 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.9)] sm:px-10 lg:min-h-[760px] lg:px-12 lg:py-14">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
            <GraduationCap size={16} />
            UniConnect
          </div>
          <h1 className="mt-8 max-w-xl font-serif text-5xl font-semibold leading-tight text-white">
            A university forum designed for serious campus communication.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">
            Join a structured platform for announcements, research conversations, academic discussion, and student engagement across the university.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Official access</p>
              <p className="mt-3 text-lg font-semibold text-white">University email verification</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Accounts are aligned to institutional roles for trusted campus participation.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Focused feed</p>
              <p className="mt-3 text-lg font-semibold text-white">Personalized by interests</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Students, faculty, and staff see the topics most relevant to their work and campus life.</p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Platform standards</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
              <li className="flex items-start gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-300" />Professional university-first design and messaging</li>
              <li className="flex items-start gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-300" />Role-based access for students, faculty, and administrators</li>
              <li className="flex items-start gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-300" />A cleaner environment for academic and institutional collaboration</li>
            </ul>
          </div>
        </section>

        <section className="university-panel p-6 sm:p-8 lg:p-10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">University Access</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">
              {mode === 'login' ? 'Sign in to continue' : 'Create your university account'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Use your institutional email to access a more professional campus discussion experience.
            </p>
          </div>

          <div className="mb-6 flex gap-2 rounded-2xl bg-slate-100 p-1.5">
            <button
              onClick={() => {
                setMode('login');
                setError('');
                setStatusMessage('');
              }}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError('');
                setStatusMessage('');
              }}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="flex-shrink-0 text-red-600" size={20} />
              <p className="text-sm leading-6 text-red-800">{error}</p>
            </div>
          )}

          {statusMessage && (
            <div className="mb-6 flex gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
              <AlertCircle className="flex-shrink-0 text-green-600" size={20} />
              <p className="text-sm leading-6 text-green-800">{statusMessage}</p>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  University Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    name="university-login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your.name@university.edu"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Must be an official university email address
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="remember-me" className="ml-2 text-sm text-slate-700">
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Login
              </button>
              <div className="pt-1 text-sm text-slate-500">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="font-medium text-blue-700 hover:text-blue-800"
                >
                  Forgot Password?
                </button>
              </div>

              {showForgotPassword && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        University Email *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="email"
                          name="university-forgot-email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          placeholder="your.name@university.edu"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Must be an official university email address
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      Reset Password
                    </button>

                    {resetSent && (
                      <div className="mt-4 flex gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                        <AlertCircle className="flex-shrink-0 text-green-600" size={20} />
                        <p className="text-sm text-green-800">Password reset email sent!</p>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <div className="flex gap-2">
                  <div className="w-full">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      placeholder="First Name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div className="w-full">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      placeholder="Last Name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  University Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    name="university-signup-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your.name@university.edu"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  I am a *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('student')}
                    className={`rounded-2xl border px-4 py-5 transition-all ${
                      selectedRole === 'student'
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <User className={`mx-auto mb-2 ${selectedRole === 'student' ? 'text-blue-600' : 'text-slate-400'}`} size={24} />
                    <div className="text-sm font-semibold text-slate-900">Student</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('faculty')}
                    className={`rounded-2xl border px-4 py-5 transition-all ${
                      selectedRole === 'faculty'
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <Users className={`mx-auto mb-2 ${selectedRole === 'faculty' ? 'text-emerald-600' : 'text-slate-400'}`} size={24} />
                    <div className="text-sm font-semibold text-slate-900">Faculty/Staff</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Department (Optional)
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., Computer Science, Engineering"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Select Your Interests * (Choose at least one)
                </label>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleInterest(option.value)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                        selectedInterests.includes(option.value)
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Your feed will prioritize topics matching your interests
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Create Account
              </button>
            </form>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-slate-200 pt-6 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>Official Email Only</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <span>Personalized Feed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-slate-700"></div>
              <span>Role Based Access</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
