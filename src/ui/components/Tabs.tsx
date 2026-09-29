import { motion } from 'motion/react';
import { spring } from '../motion';

interface Props<T extends string> {
  id: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

/** A segmented control. The white "pill" slides between options. */
export function Tabs<T extends string>({ id, value, options, onChange }: Props<T>) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`tab ${o.value === value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.div layoutId={`${id}-pill`} className="tab-bg" transition={spring} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
