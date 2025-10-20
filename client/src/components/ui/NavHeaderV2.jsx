import { motion } from 'framer-motion';
import { Moon, Sun, User } from 'lucide-react';
import { useState } from 'react';

export default function NavHeaderV2() {
  const [isDark, setIsDark] = useState(true);

  return (
    <motion.nav
      className="sticky top-0 z-50 backdrop-blur-lg border-b border-white/10"
      style={{
        background: 'rgba(11, 11, 16, 0.8)',
        boxShadow: '0 1px 0 0 rgba(124, 58, 237, 0.3)',
      }}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg md:text-xl">W</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              WordlePlus
            </h1>
          </motion.div>

          <div className="flex items-center gap-2 md:gap-4">
            <motion.button
              onClick={() => setIsDark(!isDark)}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/10 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-blue-400" />
              )}
            </motion.button>

            <motion.button
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center border border-white/20"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="User profile"
            >
              <User className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
