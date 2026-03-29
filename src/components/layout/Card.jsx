import React from 'react';

const Card = ({ children, title, subtitle, footer, className = '', style = {}, noPadding = false }) => {
    return (
        <div
            className={className}
            style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'var(--font-sans)',
                overflow: 'hidden',
                ...style
            }}
        >
            {(title || subtitle) && (
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--border)'
                }}>
                    {title && <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.125rem', fontWeight: '700' }}>{title}</h3>}
                    {subtitle && <p style={{ margin: '0.25rem 0 0', color: 'var(--text-mid)', fontSize: '0.875rem' }}>{subtitle}</p>}
                </div>
            )}

            <div style={{
                padding: noPadding ? '0' : '1.5rem',
                flex: 1
            }}>
                {children}
            </div>

            {footer && (
                <div style={{
                    padding: '1rem 1.5rem',
                    backgroundColor: 'var(--surface)',
                    borderTop: '1px solid var(--border)',
                }}>
                    {footer}
                </div>
            )}
        </div>
    );
};

export default Card;
