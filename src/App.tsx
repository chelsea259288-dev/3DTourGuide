import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Home } from './pages/Home'
import { SceneView } from './pages/SceneView'
import { WorldLabsPlayground } from './pages/WorldLabsPlayground'

function SceneViewRoute() {
  const { sceneId } = useParams<{ sceneId: string }>()
  return <SceneView key={sceneId ?? ''} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/labs/worldlabs" element={<WorldLabsPlayground />} />
        <Route path="/tour/:sceneId" element={<SceneViewRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
