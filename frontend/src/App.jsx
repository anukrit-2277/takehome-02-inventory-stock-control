import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext.jsx';
import { AlertsProvider } from './context/AlertsContext.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { Layout } from './components/Layout.jsx';

import { Login } from './pages/Login.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Items } from './pages/Items.jsx';
import { ItemDetail } from './pages/ItemDetail.jsx';
import { Movements } from './pages/Movements.jsx';
import { Alerts } from './pages/Alerts.jsx';
import { DataTransfer } from './pages/DataTransfer.jsx';
import { Admin } from './pages/Admin.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <RequireAuth>
                <AlertsProvider>
                  <Layout />
                </AlertsProvider>
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="items" element={<Items />} />
            <Route path="items/:id" element={<ItemDetail />} />
            <Route path="movements" element={<Movements />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="data" element={<DataTransfer />} />

            {/* Managers only. The server refuses these calls regardless. */}
            <Route
              path="admin"
              element={
                <RequireAuth role="MANAGER">
                  <Admin />
                </RequireAuth>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
