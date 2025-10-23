import { motion } from 'framer-motion';
import { BORDER_RADIUS, SHADOWS, TRANSITIONS } from '../../design-system';

export default function AnimatedGameCard({ 
  title, 
  subtitle, 
  icon,
  onClick, 
  className = '',
  children,
  size = 'md'
}) {
  const sizeClasses = {
    sm: 'p-4 min-h-[120px]',
    md: 'p-6 min-h-[160px]',
    lg: 'p-8 min-h-[200px]',
  };

  return (
    <motion.div
      onClick={onClick}
      className={`
        relative overflow-hidden cursor-pointer
        bg-gradient-to-br from-white/10 to-white/5
        backdrop-blur-sm border border-white/20
        ${sizeClasses[size]}
        ${className}
      `}
      style={{
        borderRadius: BORDER_RADIUS.lg,
        transition: TRANSITIONS.default,
      }}
      whileHover={{ 
        scale: 1.02,
        boxShadow: SHADOWS.glow.accent,
      }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 opacity-0 hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10 flex flex-col h-full">
        {icon && (
          <div className="mb-4 text-3xl">{icon}</div>
        )}
        
        {title && (
          <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
            {title}
          </h3>
        )}
        
        {subtitle && (
          <p className="text-white/70 text-sm md:text-base mb-4">
            {subtitle}
          </p>
        )}
        
        {children}
      </div>

      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-cyan-500"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}
