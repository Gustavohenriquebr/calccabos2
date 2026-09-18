import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import Projeto from './pages/Projeto'
import ConcursosStudy from './pages/ConcursosStudy'
import { ErrorBoundary } from './components/ErrorBoundary'

const token = () => localStorage.getItem('token')

function PrivateRoute({ children }) {
  return token() ? <ErrorBoundary>{children}</ErrorBoundary> : <Navigate to="/login" />
}

function PublicLanding() {
  return token() ? <Navigate to="/dashboard" replace /> : <Landing />
}

function PublicAuth({ children }) {
  return token() ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<PublicLanding />} />
        <Route path="/landing" element={<PublicLanding />} />
        <Route path="/login" element={<PublicAuth><Login /></PublicAuth>} />
        <Route path="/cadastro" element={<PublicAuth><Login initialMode="registro" /></PublicAuth>} />
        <Route path="/concursos" element={<ConcursosStudy />} />
        <Route path="/estudos" element={<ConcursosStudy />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/projeto/:id" element={<PrivateRoute><Projeto /></PrivateRoute>} />
      </Routes>
    </ErrorBoundary>
  )
}
