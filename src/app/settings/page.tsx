'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  email: string
  name: string
  role: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  const [ncUrl, setNcUrl] = useState('')
  const [ncUsername, setNcUsername] = useState('')
  const [ncPassword, setNcPassword] = useState('')
  const [ncSaving, setNcSaving] = useState(false)
  const [ncMsg, setNcMsg] = useState('')
  const [ncTesting, setNcTesting] = useState(false)

  const [elApiKey, setElApiKey] = useState('')
  const [orApiKey, setOrApiKey] = useState('')

  const getToken = useCallback(() => localStorage.getItem('token'), [])

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = getToken()
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    })
  }, [getToken])

  useEffect(() => {
    async function loadUser() {
      const res = await fetchWithAuth('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      setUser(data.user)
      setName(data.user.name)
      setEmail(data.user.email)
    }
    loadUser()

    // Load Nextcloud config
    async function loadNextcloud() {
      const res = await fetchWithAuth('/api/settings/nextcloud')
      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          setNcUrl(data.config.url || '')
          setNcUsername(data.config.username || '')
          setNcPassword(data.config.password || '')
        }
      }
    }
    loadNextcloud()

    // Load API keys from localStorage
    setElApiKey(localStorage.getItem('elevenlabs_api_key') || '')
    setOrApiKey(localStorage.getItem('openrouter_api_key') || '')
  }, [fetchWithAuth, router])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg('')
    try {
      const res = await fetchWithAuth('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      const data = await res.json()
      if (res.ok) {
        setProfileMsg('Profile updated successfully')
        setUser(data.user)
        localStorage.setItem('user', JSON.stringify(data.user))
      } else {
        setProfileMsg(data.error || 'Update failed')
      }
    } catch {
      setProfileMsg('Network error')
    } finally {
      setProfileSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg('')
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg('Password must be at least 8 characters')
      return
    }
    setPasswordSaving(true)
    try {
      const res = await fetchWithAuth('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setPasswordMsg('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordMsg(data.error || 'Password change failed')
      }
    } catch {
      setPasswordMsg('Network error')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function saveNextcloud(e: React.FormEvent) {
    e.preventDefault()
    setNcSaving(true)
    setNcMsg('')
    try {
      const res = await fetchWithAuth('/api/settings/nextcloud', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ncUrl, username: ncUsername, password: ncPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setNcMsg('Nextcloud settings saved')
      } else {
        setNcMsg(data.error || 'Save failed')
      }
    } catch {
      setNcMsg('Network error')
    } finally {
      setNcSaving(false)
    }
  }

  async function testNextcloud() {
    setNcTesting(true)
    setNcMsg('')
    try {
      const res = await fetchWithAuth('/api/settings/nextcloud/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ncUrl, username: ncUsername, password: ncPassword }),
      })
      const data = await res.json()
      setNcMsg(data.success ? 'Connection successful!' : `Connection failed: ${data.error}`)
    } catch {
      setNcMsg('Connection test failed')
    } finally {
      setNcTesting(false)
    }
  }

  function saveApiKeys() {
    localStorage.setItem('elevenlabs_api_key', elApiKey)
    localStorage.setItem('openrouter_api_key', orApiKey)
    alert('API keys saved to browser storage')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-lg font-bold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Profile</h2>
          <form onSubmit={saveProfile} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            {profileMsg && (
              <p className={`text-sm ${profileMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {profileMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:bg-primary-400 transition"
            >
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Change Password</h2>
          <form onSubmit={changePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            {passwordMsg && (
              <p className={`text-sm ${passwordMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {passwordMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:bg-primary-400 transition"
            >
              {passwordSaving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Nextcloud Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Nextcloud Integration</h2>
          <p className="text-sm text-gray-500 mb-4">Connect to your Nextcloud instance to import PDFs</p>
          <form onSubmit={saveNextcloud} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nextcloud URL</label>
              <input
                type="url"
                value={ncUrl}
                onChange={(e) => setNcUrl(e.target.value)}
                placeholder="https://your-nextcloud.com/remote.php/dav/files/username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={ncUsername}
                onChange={(e) => setNcUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password / App Token</label>
              <input
                type="password"
                value={ncPassword}
                onChange={(e) => setNcPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            {ncMsg && (
              <p className={`text-sm ${ncMsg.includes('success') || ncMsg.includes('successful') ? 'text-green-600' : 'text-red-600'}`}>
                {ncMsg}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={testNextcloud}
                disabled={ncTesting || !ncUrl}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {ncTesting ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="submit"
                disabled={ncSaving}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:bg-primary-400 transition"
              >
                {ncSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* API Keys Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">API Keys</h2>
          <p className="text-sm text-gray-500 mb-4">Keys are stored in your browser. Never sent to our servers without your action.</p>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ElevenLabs API Key</label>
              <input
                type="password"
                value={elApiKey}
                onChange={(e) => setElApiKey(e.target.value)}
                placeholder="Your ElevenLabs API key for text-to-speech"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Get your key at{' '}
                <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  elevenlabs.io
                </a>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OpenRouter API Key</label>
              <input
                type="password"
                value={orApiKey}
                onChange={(e) => setOrApiKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Get your key at{' '}
                <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  openrouter.ai
                </a>
              </p>
            </div>
            <button
              onClick={saveApiKeys}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition"
            >
              Save API Keys
            </button>
          </div>
        </div>

        {user && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Account Info</h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Role:</span> {user.role}</p>
              <p><span className="font-medium">User ID:</span> {user.id}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
