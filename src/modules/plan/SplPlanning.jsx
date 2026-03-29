import React from 'react';
import { Sparkles } from 'lucide-react';


export default function SplPlanning() {
  return (
    <div className="planning-system-container">
      <div className="planning-system-card">
        <div className="planning-system-header" style={{ padding: '2rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
          <h1 className="planning-system-title" style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Special Planning</h1>
          <p className="planning-system-subtitle" style={{ color: 'var(--text-muted)' }}>Process all SPL items</p>
        </div>
        <div className="planning-system-content" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div className="results-empty-state" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="empty-state-icon-container" style={{ 
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
              width: '80px', height: '80px', borderRadius: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 2rem'
            }}>
              <Sparkles size={40} color="var(--primary)" />
            </div>
            <h3 className="empty-state-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              Special Module Locked
            </h3>
            <p className="empty-state-message" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              The Special Planning module is undergoing a structural overhaul to support advanced multi-layered nesting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
