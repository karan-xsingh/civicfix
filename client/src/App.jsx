import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ReportIssue from './pages/ReportIssue.jsx';
import PublicMap from './pages/PublicMap.jsx';
import TrackReport from './pages/TrackReport.jsx';
import OfficerDesk from './pages/OfficerDesk.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-5 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/report" replace />} />
          <Route path="/report" element={<ReportIssue />} />
          <Route path="/map" element={<PublicMap />} />
          <Route path="/track" element={<TrackReport />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/officer"
            element={
              <ProtectedRoute roles={['officer', 'admin']}>
                <OfficerDesk />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
