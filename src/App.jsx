import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import NoteForm from './pages/NoteForm';
import Dashboard from './pages/Dashboard';
import Archives from './pages/Archives';
import Profile from './pages/Profile';
import NotePrintView from './pages/NotePrintView';
import { UserProvider } from './context/UserContext';
import { DatabaseProvider } from './context/DatabaseContext';
import { UserContext } from './context/UserContext';
import Documentation from './pages/Documentation';
import Training from './pages/Training';

// Composant pour protéger les routes
const ProtectedRoute = ({ children }) => {
  const { user } = React.useContext(UserContext);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = React.useContext(UserContext);
  if (user) {
    return (user.role === 'superadmin') ? <Navigate to="/dashboard" replace /> : <Navigate to="/note/new" replace />;
  }
  return children;
};

const IndexRoute = () => {
  const { user } = React.useContext(UserContext);
  return (user?.role === 'superadmin') ? <Navigate to="/dashboard" replace /> : <Navigate to="/note/new" replace />;
};

function App() {
  return (
    <UserProvider>
      <DatabaseProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            
            {/* Protected Routes (Wrapped in Layout) */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<IndexRoute />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="note/new" element={<NoteForm />} />
              <Route path="archives" element={<Archives />} />
              <Route path="profile" element={<Profile />} />
              <Route path="documentation" element={<Documentation />} />
              <Route path="training" element={<Training />} />
            </Route>
            
            {/* Route d'impression sans le Layout (sans menu/navigation) */}
            <Route path="/print-note" element={<ProtectedRoute><NotePrintView /></ProtectedRoute>} />
          </Routes>
        </Router>
      </DatabaseProvider>
    </UserProvider>
  );
}

export default App;
