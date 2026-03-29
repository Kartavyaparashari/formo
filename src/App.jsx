import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/* Auth & Context */
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/routing/ProtectedRoute';
import AdminProtectedRoute from './components/routing/AdminProtectedRoute';

/* Layout */
import Navbar from './components/layout/Navbar';

/* Modules */
import AuthPage from './modules/auth/AuthPage';
import FormoHomepage from './modules/home/HomePage';
import Appearance from './modules/settings/Appearance';
import AdminPanel from './modules/admin/AdminPanel';
import Planning from './modules/settings/Planning';
import SortMaster from './modules/plan/SortMaster';
import PnlPlanning from './modules/plan/PnlPlanning';
import SecPlanning from './modules/plan/SecPlanning';
import SplPlanning from './modules/plan/SplPlanning';
import IPOImport from './modules/import/IPOImport';
import BarcodeImport from './modules/import/BarcodeImport';
import PnlImport from './modules/import/PnlImport';
import RMCalculation from './modules/material/RMCalculation';
import ItemsModification from './modules/material/ItemsModification';

/* Reporting */
import Production from './modules/reports/Production';
import MISReport from './modules/reports/MISReport';
import LotUnitReport from './modules/reports/LotUnitReport';
import ProductionGraph from './modules/reports/ProductionGraph';

function AppContent() {
  const location = useLocation();
  
  return (
    <Routes>
      {/* Public auth page — no Navbar/Footer */}
      <Route path="/auth" element={<AuthPage />} />

      {/* All other pages share the shell with Navbar + Footer */}
      <Route
        path="/*"
        element={
          <div className="dynamic-theme app-shell">
            <Navbar />
            <div className="app-shell-body">
              <div className="app-shell-content">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="app-route-wrapper"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                  >
                    <Routes location={location}>
                      {/* Public pages */}
                      <Route path="/" element={<FormoHomepage />} />

                      {/* Protected pages — require login */}
                      <Route
                        path="/settings/appearance"
                        element={
                          <ProtectedRoute>
                            <Appearance />
                          </ProtectedRoute>
                        }
                      />

                      {/* Admin-only page */}
                      <Route
                        path="/admin"
                        element={
                          <AdminProtectedRoute>
                            <AdminPanel />
                          </AdminProtectedRoute>
                        }
                      />

                      <Route
                        path="/settings/planning"
                        element={
                          <ProtectedRoute>
                            <Planning />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/planning/:tabId"
                        element={
                          <ProtectedRoute>
                            <Planning />
                          </ProtectedRoute>
                        }
                      />
                      {/* Planning suite */}
                      <Route
                        path="/plan/sort-master"
                        element={
                          <ProtectedRoute>
                            <SortMaster />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/plan/pnl"
                        element={
                          <ProtectedRoute>
                            <PnlPlanning />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/plan/sec"
                        element={
                          <ProtectedRoute>
                            <SecPlanning />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/plan/spl"
                        element={
                          <ProtectedRoute>
                            <SplPlanning />
                          </ProtectedRoute>
                        }
                      />
                      {/* Import module */}
                      <Route
                        path="/import/ipo"
                        element={
                          <ProtectedRoute>
                            <IPOImport />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/import/barcode"
                        element={
                          <ProtectedRoute>
                            <BarcodeImport />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/import/pnl-master"
                        element={
                          <ProtectedRoute>
                            <PnlImport />
                          </ProtectedRoute>
                        }
                      />
                      {/* Material module */}
                      <Route
                        path="/material/rm-calc"
                        element={
                          <ProtectedRoute>
                            <RMCalculation />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/material/items-mod"
                        element={
                          <ProtectedRoute>
                            <ItemsModification />
                          </ProtectedRoute>
                        }
                      />
                      {/* Reports module */}
                      <Route
                        path="/reports/production"
                        element={
                          <ProtectedRoute>
                            <Production />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports/mis"
                        element={
                          <ProtectedRoute>
                            <MISReport />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports/lot-wise"
                        element={
                          <ProtectedRoute>
                            <LotUnitReport />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports/graph"
                        element={
                          <ProtectedRoute>
                            <ProductionGraph />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
