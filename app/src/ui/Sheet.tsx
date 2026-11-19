import { motion } from 'motion/react';
import { X } from 'lucide-react';

// Painel inferior reutilizado por várias telas.
export function Sheet({ children, onClose, title }: any) {
  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative rounded-t-[24px] bg-dusk border-t border-white/10 p-4 pb-[max(env(safe-area-inset-bottom),20px)]" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-display uppercase text-2xl">{title}</h3><button onClick={onClose} aria-label="Fechar" className="size-9 grid place-items-center rounded-full bg-white/10"><X size={18} /></button></div>
        {children}
      </motion.div>
    </motion.div>
  );
}
