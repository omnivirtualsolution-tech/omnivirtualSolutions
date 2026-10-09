import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CmsProvider } from './context/CmsContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollTop from './components/ScrollTop';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Automatically scrolls to top on route change & logs real visits to SQLite
function ScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  // Record visitor telemetry once per authentic visitor session (exclude admins and localhost)
  useEffect(() => {
    try {
      const isAdmin = Boolean(localStorage.getItem('omni_admin_token') || sessionStorage.getItem('omni_admin_token'));
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isTracked = sessionStorage.getItem('omni_session_visit');

      if (!isAdmin && !isLocal && !isTracked) {
        sessionStorage.setItem('omni_session_visit', String(Date.now()));
        fetch('/api/v1/track-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: pathname,
            referrer: document.referrer || 'direct',
          }),
        }).catch(() => {});
      }
    } catch (_) {}
  }, []);

  return null;
}

export default function App() {
  useEffect(() => {
    // Initialize AOS animations if present in window
    if (window.AOS) {
      window.AOS.init({
        duration: 600,
        easing: 'ease-in-out',
        once: true,
        mirror: false,
      });
    }
    // Safety fallback: ensure preloader is dismissed after React mounts
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && typeof window.dismissPreloader === 'function') {
        window.dismissPreloader();
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <CmsProvider>
      <Router>
        <ScrollToTopOnNavigate />
        <Navbar />
        <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a84c' }}><span className="spinner-border spinner-border-sm me-2"></span>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="/services.html" element={<Navigate to="/services" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Footer />
        <ScrollTop />
      </Router>
    </CmsProvider>
  );
}
