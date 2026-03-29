import React from 'react';

const Radio = React.forwardRef(({
    label,
    checked,
    onChange,
    disabled = false,
    value,
    name,
    variant = 'primary',
    size = 'md',
    className = '',
    style = {},
    ...props
}, ref) => {
    // Get accent color based on variant
    const getVariantColor = () => {
        switch (variant) {
            case 'secondary':
                return 'var(--secondary)';
            case 'outline':
                return 'var(--primary)';
            case 'danger':
                return '#ef4444';
            case 'primary':
            default:
                return 'var(--primary)';
        }
    };

    // Size styles for the radio circle and label font
    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return { width: '16px', height: '16px', fontSize: '12px' };
            case 'lg':
                return { width: '24px', height: '24px', fontSize: '16px' };
            case 'md':
            default:
                return { width: '20px', height: '20px', fontSize: '14px' };
        }
    };

    const accentColor = getVariantColor();
    const sizeStyles = getSizeStyles();

    // Wrapper styles (label)
    const wrapperStyles = {
        display: 'inline-flex',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'var(--font-sans)',
        ...style,
    };

    // Custom radio outer circle styles
    const radioOuterStyles = {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...sizeStyles,
        borderRadius: '50%', // circular shape
        border: `1px solid ${accentColor}`,
        backgroundColor: checked ? accentColor : 'transparent',
        transition: 'all 0.2s ease',
        marginRight: '8px',
        flexShrink: 0,
    };

    // Inner dot (visible when checked)
    const innerDotStyles = {
        width: '50%',
        height: '50%',
        borderRadius: '50%',
        backgroundColor: checked ? 'white' : 'transparent',
        transition: 'background-color 0.2s ease',
    };

    return (
        <label style={wrapperStyles} className={className}>
            <input
                type="radio"
                ref={ref}
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                value={value}
                name={name}
                style={{ display: 'none' }}
                {...props}
            />
            <div style={radioOuterStyles}>
                <div style={innerDotStyles} />
            </div>
            {label && <span style={{ fontSize: sizeStyles.fontSize }}>{label}</span>}
        </label>
    );
});

Radio.displayName = 'Radio';
export default Radio;