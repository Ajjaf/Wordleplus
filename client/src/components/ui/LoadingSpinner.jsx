import { motion } from "framer-motion";

/**
 * Reusable loading spinner component with multiple variants
 * @param {Object} props
 * @param {string} props.size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} props.variant - 'primary' | 'secondary' | 'white'
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.text - Optional text to display below spinner
 */
export default function LoadingSpinner({
  size = "md",
  variant = "primary",
  className = "",
  text = null,
}) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-2",
    lg: "w-12 h-12 border-3",
    xl: "w-16 h-16 border-4",
  };

  const variantClasses = {
    primary: "border-violet-500/30 border-t-violet-500",
    secondary: "border-cyan-500/30 border-t-cyan-500",
    white: "border-white/30 border-t-white",
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <motion.div
        className={`rounded-full ${sizeClasses[size]} ${variantClasses[variant]}`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      {text && (
        <motion.p
          className="mt-3 text-sm text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}

/**
 * Full-screen loading overlay
 */
export function LoadingOverlay({ text = "Loading...", className = "" }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${className}`}
    >
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl">
        <LoadingSpinner size="lg" variant="white" text={text} />
      </div>
    </div>
  );
}

/**
 * Inline loading indicator for buttons
 */
export function LoadingButtonContent({ text = "Loading..." }) {
  return (
    <div className="flex items-center gap-2">
      <LoadingSpinner size="sm" variant="white" />
      <span>{text}</span>
    </div>
  );
}

