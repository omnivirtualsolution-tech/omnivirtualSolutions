import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  useEffect(() => {
    document.title = '404 Page Not Found — Omni Virtual Solutions';
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="main">
      <section
        style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '120px 20px 80px',
          background: 'linear-gradient(180deg, #090d16 0%, #0d1322 100%)',
          color: '#f8fafc',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-block',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#eba22d',
              background: 'rgba(235, 162, 45, 0.1)',
              border: '1px solid rgba(235, 162, 45, 0.3)',
              borderRadius: '30px',
              padding: '6px 18px',
              marginBottom: '24px',
            }}
          >
            Error 404
          </div>

          <h1
            style={{
              fontSize: 'clamp(48px, 8vw, 84px)',
              fontWeight: 800,
              lineHeight: 1.05,
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #ffffff 40%, #c9a84c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-1.5px',
            }}
          >
            Page Not Found
          </h1>

          <p
            style={{
              fontSize: '17px',
              lineHeight: '1.6',
              color: '#94a3b8',
              marginBottom: '36px',
            }}
          >
            The destination you requested may have been relocated, updated, or does not exist.
            Please return to our homepage or explore our publishing and executive specialist services.
          </p>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #eba22d 0%, #c78619 100%)',
                color: '#0a0e17',
                fontWeight: 700,
                fontSize: '15px',
                padding: '14px 28px',
                borderRadius: '8px',
                textDecoration: 'none',
                boxShadow: '0 4px 18px rgba(235, 162, 45, 0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              <i className="bi bi-house-door-fill"></i> Return Home
            </Link>

            <Link
              to="/services"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#f8fafc',
                fontWeight: 600,
                fontSize: '15px',
                padding: '14px 26px',
                borderRadius: '8px',
                textDecoration: 'none',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                transition: 'background 0.2s',
              }}
            >
              <i className="bi bi-grid-fill"></i> View Services
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
