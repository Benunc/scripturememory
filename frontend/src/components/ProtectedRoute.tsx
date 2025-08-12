import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthContext();
  const location = useLocation();

  // Don't redirect while loading
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to signin with the current path as the redirect destination
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/?redirect=${redirectUrl}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 