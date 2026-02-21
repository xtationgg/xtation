import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import App from '../App';
import { ResetPassword } from '../components/Views/ResetPassword';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

