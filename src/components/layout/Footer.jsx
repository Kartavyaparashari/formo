import React from 'react';

const Footer = ({ companyName = 'FORMO ERP', version = '1.0.0', className = '', style = {} }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={className}
      style={{
        backgroundColor: 'var(--surface)',
        borderTop: '1px solid rgba(148, 163, 184, 0.2)',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.875rem',
        color: 'var(--secondary)',
        gap: '1rem',
        ...style
      }}
    >
      <div>
        &copy; {currentYear} {companyName}. All rights reserved.
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <a
          href="#"
          style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = 'var(--primary)'}
          onMouseLeave={(e) => e.target.style.color = 'inherit'}
        >
          Support
        </a>
        <a
          href="#"
          style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = 'var(--primary)'}
          onMouseLeave={(e) => e.target.style.color = 'inherit'}
        >
          Privacy Policy
        </a>
        <a
          href="#"
          style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = 'var(--primary)'}
          onMouseLeave={(e) => e.target.style.color = 'inherit'}
        >
          Terms of Service
        </a>
        <span style={{ paddingLeft: '0.75rem', borderLeft: '1px solid rgba(148, 163, 184, 0.3)' }}>
          v{version}
        </span>
      </div>
    </footer>
  );
};

export default Footer;
