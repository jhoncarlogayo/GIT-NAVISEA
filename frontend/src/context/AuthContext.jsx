import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { ref, set, get, onValue, off } from 'firebase/database'
import { auth, db } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined)
  const [role,    setRole]    = useState(null)
  const [users,   setUsers]   = useState([])
  const [error,   setError]   = useState('')

  async function fetchRole(uid) {
    const snap = await get(ref(db, `/users/${uid}/role`))
    setRole(snap.exists() ? snap.val() : null)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u ?? null)
      if (u) fetchRole(u.uid)
      else   setRole(null)
    })
    // Listen to all users for assign dropdown
    const r = ref(db, 'users')
    onValue(r, snap => {
      const data = snap.val() ?? {}
      setUsers(Object.entries(data).map(([uid, u]) => ({ uid, ...u })))
    })
    return () => { unsub(); off(r) }
  }, [])

  async function login(email, password) {
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
        ? 'Invalid email or password.'
        : 'Login failed. Please try again.')
    }
  }

  async function register(email, password, selectedRole) {
    setError('')
    let cred
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password)
    } catch (e) {
      console.error('Register error:', e.code, e.message)
      setError(
        e.code === 'auth/email-already-in-use' ? 'Email already in use.' :
        e.code === 'auth/weak-password'        ? 'Password must be at least 6 characters.' :
        `Error: ${e.code}`
      )
      return
    }
    try {
      await set(ref(db, `/users/${cred.user.uid}`), { role: selectedRole, email })
    } catch (e) {
      // Account created but role save failed — still let them in, role will be null
      console.warn('Role save failed:', e.code, e.message)
    }
  }

  async function loginWithGoogle() {
    setError('')
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider())
      // If new Google user, assign staff role by default
      const snap = await get(ref(db, `/users/${cred.user.uid}/role`))
      if (!snap.exists()) {
        await set(ref(db, `/users/${cred.user.uid}`), { role: 'staff', email: cred.user.email })
      }
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user')
        setError('Google sign-in failed. Please try again.')
    }
  }

  function logout() { signOut(auth) }

  return (
    <AuthContext.Provider value={{ user, role, users, login, register, loginWithGoogle, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
