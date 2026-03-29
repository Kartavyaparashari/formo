import React from 'react';
import { BarChart3 } from 'lucide-react';
import '../../assets/styles/components/SortMaster.css';

export default function Production() {
  return (
    <div className="planning-system-container">
      <div className="planning-system-card">
        <div className="planning-system-header" style={{ padding: '2rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
          <h1 className="planning-system-title" style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Production Report</h1>
          <p className="planning-system-subtitle" style={{ color: 'var(--text-muted)' }}>Real-time production throughput analytics</p>
        </div>
        <div className="planning-system-content" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div className="results-empty-state" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="empty-state-icon-container" style={{ 
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
              width: '80px', height: '80px', borderRadius: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 2rem'
            }}>
              <BarChart3 size={40} color="var(--primary)" />
            </div>
            <h3 className="empty-state-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              Report Generator Initializing
            </h3>
            <p className="empty-state-message" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              The Production Report engine is currently being synced with the real-time IoT floor sensors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
