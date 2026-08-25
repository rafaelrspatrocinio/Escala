import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminMinistries from './pages/AdminMinistries.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminEvents from './pages/AdminEvents.jsx';
import AdminSchedule from './pages/AdminSchedule.jsx';
import VolunteerHome from './pages/VolunteerHome.jsx';
import VolunteerUnavailability from './pages/VolunteerUnavailability.jsx';

function ProtectedRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="container">Carregando...</div>;

  return (
    <>
      {user && <Navbar />}
      <div className="container">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/registrar" element={user ? <Navigate to="/" replace /> : <Register />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                {user?.role === 'ADMIN' ? <Navigate to="/admin/escala" replace /> : <VolunteerHome />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/indisponibilidade"
            element={
              <ProtectedRoute>
                <VolunteerUnavailability />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/ministerios"
            element={
              <ProtectedRoute adminOnly>
                <AdminMinistries />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/voluntarios"
            element={
              <ProtectedRoute adminOnly>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/eventos"
            element={
              <ProtectedRoute adminOnly>
                <AdminEvents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/escala"
            element={
              <ProtectedRoute adminOnly>
                <AdminSchedule />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
