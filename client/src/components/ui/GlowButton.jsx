import { motion } from 'framer-motion';
import { GRADIENTS, SHADOWS, TRANSITIONS } from '../../design-system';

export default function GlowButton({ 
  children, 
  onClick, 
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  ...props 
}) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm min-h-[40px]',
    md: 'px-6 py-3 text-base min-h-[48px]',
    lg: 'px-8 py-4 text-lg min-h-[56px]',
  };

  const variantStyles = {
    primary: {
      background: GRADIENTS.accent,
      boxShadow: SHADOWS.glow.accent,
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    ghost: {
      background: 'transparent',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative rounded-full font-semibold
        text-white overflow-hidden
        transition-all duration-300 ease-out
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        ...variantStyles[variant],
        backgroundSize: variant === 'primary' ? '200% 100%' : undefined,
      }}
      whileHover={disabled ? {} : { 
        scale: 1.05,
        backgroundPosition: variant === 'primary' ? '100% 0' : undefined,
      }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
