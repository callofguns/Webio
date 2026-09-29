import type { ComponentProps } from 'react';
import { motion } from 'motion/react';
import { spring, tap } from '../motion';

type Props = ComponentProps<typeof motion.button> & {
  variant?: 'primary' | 'ghost' | 'default';
  size?: 'sm' | 'md';
  block?: boolean;
};

export function Button({ variant = 'default', size = 'md', block, className = '', ...rest }: Props) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', className]
    .filter(Boolean)
    .join(' ');
  return <motion.button whileTap={rest.disabled ? undefined : tap} transition={spring} className={cls} {...rest} />;
}
