import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RegionProvider } from './context/RegionContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Trials from './pages/Trials';
import Complaints from './pages/Complaints';
import Movements from './pages/Movements';
import LostCustomers from './pages/LostCustomers';
import Salesmen from './pages/Salesmen';
import VisitPlans from './pages/VisitPlans';
import Products from './pages/Products';
import SelfAppraisal from './pages/SelfAppraisal';
import CoatingSamples from './pages/CoatingSamples';
import Orders from './pages/Orders';
import Vehicles from './pages/Vehicles';
import Dispatches from './pages/Dispatches';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <RegionProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/trials" element={<ProtectedRoute><Trials /></ProtectedRoute>} />
          <Route path="/complaints" element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
          <Route path="/visit-plans" element={<ProtectedRoute><VisitPlans /></ProtectedRoute>} />
          <Route path="/movements" element={<ProtectedRoute><Movements /></ProtectedRoute>} />
          <Route path="/lost-customers" element={<ProtectedRoute><LostCustomers /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/self-appraisal" element={<ProtectedRoute><SelfAppraisal /></ProtectedRoute>} />
          <Route path="/coating-samples" element={<ProtectedRoute><CoatingSamples /></ProtectedRoute>} />
          <Route path="/salesmen" element={<ProtectedRoute><Salesmen /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
          <Route path="/dispatches" element={<ProtectedRoute><Dispatches /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      </RegionProvider>
    </AuthProvider>
  );
}

export default App;
