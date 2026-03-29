import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';

/**
 * AdminProtectedRoute — wraps routes that only admin / superadmin can see.
 * It checks the profiles.role against the Supabase DB once the session is ready.
 */
export default function AdminProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:"'Rajdhani', sans-serif", fontSize:18, color:'#0055bb' }}>
        Checking permissions…
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!profile || !['admin','superadmin'].includes(profile.role)) return <Navigate to="/" replace />;

  return children;
}
