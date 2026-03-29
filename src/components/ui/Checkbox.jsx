import React from 'react';

const Checkbox = React.forwardRef(({
    label,
    checked,
    onChange,
    disabled = false,
    indeterminate = false,
    variant = 'primary',
    size = 'md',
    className = '',
    style = {},
    ...props
}, ref) => {
    const inputRef = React.useRef(null);

    // Manage indeterminate state via ref
    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.indeterminate = indeterminate;
        }
    }, [indeterminate]);

    // Get accent color based on variant
    const getVariantColor = () => {
        switch (variant) {
            case 'secondary':
                return 'var(--secondary)';
            case 'outline':
                return 'var(--primary)'; // outline uses primary for border/check
            case 'danger':
                return '#ef4444';
            case 'primary':
            default:
                return 'var(--primary)';
        }
    };

    // Size styles for the checkbox box and label font
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

    // Custom checkbox box styles
    const checkboxStyles = {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...sizeStyles,
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${accentColor}`,
        backgroundColor: checked ? accentColor : 'transparent',
        transition: 'all 0.2s ease',
        marginRight: '8px',
        flexShrink: 0,
    };

    // Checkmark SVG (data URI for white check)
    const checkmarkSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M20 6L9 17l-5-5' stroke='white' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

    const checkmarkStyles = {
        width: '70%',
        height: '70%',
        display: checked ? 'block' : 'none',
        background: checkmarkSvg,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
    };

    // Indeterminate dash (horizontal line)
    const indeterminateStyles = {
        width: '70%',
        height: '2px',
        backgroundColor: 'white',
        display: indeterminate && !checked ? 'block' : 'none',
    };

    return (
        <label style={wrapperStyles} className={className}>
            <input
                type="checkbox"
                ref={(node) => {
                    inputRef.current = node;
                    if (ref) {
                        if (typeof ref === 'function') ref(node);
                        else ref.current = node;
                    }
                }}
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                style={{ display: 'none' }}
                {...props}
            />
            <div style={checkboxStyles}>
                <div style={checkmarkStyles} />
                <div style={indeterminateStyles} />
            </div>
            {label && <span style={{ fontSize: sizeStyles.fontSize }}>{label}</span>}
        </label>
    );
});

Checkbox.displayName = 'Checkbox';
export default Checkbox;