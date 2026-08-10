import { motion } from "framer-motion";

/**
 * FloatingChip
 * Small glass notification pill that floats over hero/section imagery
 * (e.g. "Message delivered", "Private & secure"). Reusable across
 * Landing sections instead of duplicating the same markup per section.
 *
 * Props:
 *  - icon: lucide icon component
 *  - iconColor: text color class for the icon
 *  - iconBg: inline background style for the icon well
 *  - title / subtitle: the two text lines
 *  - position: tailwind classes for absolute placement (default bottom-right)
 *  - delay: animation delay in seconds
 */
export function FloatingChip({
  icon: Icon,
  iconColor = "text-ayana-mint",
  iconBg = "rgba(47,230,167,0.18)",
  title,
  subtitle,
  position = "-bottom-5 -right-5",
  delay = 0.6,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute ${position} rounded-2xl px-5 py-3.5 flex items-center gap-3 animate-float shadow-xl border border-white/10 z-10`}
      style={{ background: "rgba(6,26,20,0.9)", backdropFilter: "blur(16px)" }}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={1.75} />}
      </span>
      <div>
        <p className="text-xs font-bold text-white leading-tight">{title}</p>
        <p className="text-xs text-white/45 leading-tight mt-0.5">{subtitle}</p>
      </div>
    </motion.div>
  );
}
