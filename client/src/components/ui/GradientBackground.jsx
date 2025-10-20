import { motion } from 'framer-motion';
import { COLORS, GRADIENTS } from '../../design-system';

export default function GradientBackground({ children, className = '' }) {
  return (
    <div className={`relative min-h-screen overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-0 -z-10"
        style={{
          background: GRADIENTS.background,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30"
          style={{
            background: `radial-gradient(circle, ${COLORS.accent.violet} 0%, transparent 70%)`,
          }}
          animate={{
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        <motion.div
          className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${COLORS.accent.cyan} 0%, transparent 70%)`,
          }}
          animate={{
            y: [0, -40, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
      
      {children}
    </div>
  );
}
