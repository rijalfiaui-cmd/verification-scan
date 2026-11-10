import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { staff, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading" role="status" aria-label="Memuat sesi">
        <div className="app-loading-header skeleton" />
        <div className="app-loading-panel skeleton" />
        <div className="app-loading-line skeleton" />
      </div>
    );
  }

  if (!staff) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
