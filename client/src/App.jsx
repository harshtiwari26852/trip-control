import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/Header'
import Hero from './components/Hero'
import Trips from './components/Trips'
import Planner from './pages/Planner'
import SavedPlans from './pages/SavedPlans'
import Signin from './pages/Signin'
import Signup from './pages/Signup'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/signin" replace />
  return children
}

function App() {
  const location = useLocation()
  return (
    <AuthProvider>
      <Header />
      <Routes>
        <Route
          path="/"
          element={
            <main>
              <Hero />
              <Trips />
            </main>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <main className="pt-14">
                <Planner key={location.key} />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/plans"
          element={
            <ProtectedRoute>
              <main className="pt-14">
                <SavedPlans />
              </main>
            </ProtectedRoute>
          }
        />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
