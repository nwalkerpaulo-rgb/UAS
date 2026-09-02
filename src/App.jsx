import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SessionsList from './pages/SessionsList'
import SessionStart from './pages/SessionStart'
import SessionDetail from './pages/SessionDetail'
import Missions from './pages/Missions'
import Maintenance from './pages/Maintenance'
import Incidents from './pages/Incidents'
import IncidentNew from './pages/IncidentNew'
import IncidentDetail from './pages/IncidentDetail'
import Drones from './pages/Drones'
import DroneDetail from './pages/DroneDetail'
import Batteries from './pages/Batteries'
import BatteryDetail from './pages/BatteryDetail'
import CounterDrone from './pages/CounterDrone'
import Equipment from './pages/Equipment'
import Users from './pages/Users'
import Pilots from './pages/Pilots'
import PilotDetail from './pages/PilotDetail'
import MapView from './pages/MapView'
import Heatmaps from './pages/Heatmaps'
import MissionPlans from './pages/MissionPlans'
import MissionPlanNew from './pages/MissionPlanNew'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import CreatePilot from './pages/CreatePilot'
import Detections from './pages/Detections'
import DetectionNew from './pages/DetectionNew'
import CounterDroneDetail from './pages/CounterDroneDetail'
import Alerts from './pages/Alerts'
import Bases from './pages/Bases'
import Settings from './pages/Settings'
import LiveOps from './pages/LiveOps'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessoes" element={<SessionsList />} />
            <Route path="/sessoes/nova" element={<SessionStart />} />
            <Route path="/sessoes/:id" element={<SessionDetail />} />
            <Route path="/missoes" element={<Missions />} />
            <Route path="/manutencao" element={<Maintenance />} />
            <Route path="/mapa" element={<MapView />} />
            <Route path="/heatmaps" element={<Heatmaps />} />
            <Route path="/missoes/planeamento" element={<MissionPlans />} />
            <Route path="/missoes/planeamento/nova" element={<MissionPlanNew />} />
            <Route path="/analise" element={<Analytics />} />
            <Route path="/relatorios" element={<Reports />} />
            <Route
              path="/pilotos/novo"
              element={
                <ProtectedRoute adminOnly>
                  <CreatePilot />
                </ProtectedRoute>
              }
            />
            <Route path="/incidentes" element={<Incidents />} />
            <Route path="/incidentes/nova" element={<IncidentNew />} />
            <Route path="/incidentes/:id" element={<IncidentDetail />} />
            <Route path="/deteccoes" element={<Detections />} />
            <Route path="/deteccoes/nova" element={<DetectionNew />} />
            <Route path="/drones" element={<Drones />} />
            <Route path="/drones/:id" element={<DroneDetail />} />
            <Route path="/baterias" element={<Batteries />} />
            <Route path="/baterias/:id" element={<BatteryDetail />} />
            <Route path="/contra-drone" element={<CounterDrone />} />
            <Route path="/contra-drone/:id" element={<CounterDroneDetail />} />
            <Route path="/alertas" element={<Alerts />} />
            <Route path="/bases" element={<Bases />} />
            <Route path="/configuracoes" element={<Settings />} />
            <Route path="/operacoes-vivo" element={<LiveOps />} />
            <Route path="/equipamento" element={<Equipment />} />
            <Route path="/utilizadores" element={<Users />} />
            <Route
              path="/pilotos"
              element={
                <ProtectedRoute adminOnly>
                  <Pilots />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pilotos/:id"
              element={
                <ProtectedRoute adminOnly>
                  <PilotDetail />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
