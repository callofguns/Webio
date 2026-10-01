import { Button } from './Button';

/** "← Back" used on phones to go from a detail page back to its list. */
export function BackButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="ghost" size="sm" className="back-btn" onClick={onClick} disabled={disabled}>
      &larr; {label}
    </Button>
  );
}
