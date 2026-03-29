import React from 'react';

const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  className = '',
  style = {},
  ...props
}, ref) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: 'var(--secondary)',
          color: '#ffffff',
          border: '1px solid var(--secondary)',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--primary)',
          border: '1px solid var(--primary)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text)',
          border: 'none',
          boxShadow: 'none',
        };
      case 'danger':
        return {
          backgroundColor: 'rgba(239,68,68,0.1)',
          color: '#ef4444',
          border: '1px solid rgba(239,68,68,0.3)',
        };
      case 'primary':
      default:
        return {
          backgroundColor: 'var(--primary)',
          color: '#ffffff',
          border: '1px solid var(--primary)',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)' };
      case 'lg':
        return { padding: '12px 24px', fontSize: '16px', borderRadius: 'var(--radius-lg)' };
      case 'md':
      default:
        return { padding: '8px 16px', fontSize: '14px', borderRadius: 'var(--radius-md)' };
    }
  };

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '500',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.2s ease',
    width: fullWidth ? '100%' : 'auto',
    fontFamily: 'var(--font-sans)',
    boxShadow: variant !== 'ghost' ? 'var(--shadow-sm)' : 'none',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <button
      ref={ref}
      style={baseStyles}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {loading && (
        <svg
          style={{
            animation: 'spin 1s linear infinite',
            marginRight: '8px',
            height: '16px',
            width: '16px',
            color: 'inherit'
          }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            style={{ opacity: 0.25 }}
          ></circle>
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            style={{ opacity: 0.75 }}
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
