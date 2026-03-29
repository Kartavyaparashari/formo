import React from 'react';

const PageHeader = ({ title, breadcrumbs = [], actions, className = '', style = {} }) => {
  return (
    <div 
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem',
        fontFamily: 'var(--font-sans)',
        ...style
      }}
    >
      <div>
        {breadcrumbs.length > 0 && (
          <nav style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--secondary)' }}>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span>/</span>}
                <span style={{ 
                  color: index === breadcrumbs.length - 1 ? 'var(--text)' : 'inherit',
                  fontWeight: index === breadcrumbs.length - 1 ? '500' : 'normal',
                  cursor: index !== breadcrumbs.length - 1 ? 'pointer' : 'default'
                }}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: 'var(--text)' }}>
          {title}
        </h1>
      </div>

      {actions && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
