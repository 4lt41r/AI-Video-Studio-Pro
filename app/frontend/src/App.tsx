import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import HomePage from './pages/Home'
import EditorPage from './pages/Editor'
import { useUIStore } from './store/ui'

export default function App() {
  const setBackendUrl = useUIStore(s => s.setBackendUrl)

  useEffect(() => {
    // Electron injects the backend URL; fall back to dev default
    const url = (window as any).__APP_API__ ?? 'http://127.0.0.1:8000'
    setBackendUrl(url)
  }, [setBackendUrl])

  return (
    <div className="h-full w-full bg-surface-0 text-white select-none">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor/:projectId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
