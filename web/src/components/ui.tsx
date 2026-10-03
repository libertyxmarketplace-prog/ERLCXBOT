import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '../cn';

const buttonStyles = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70 disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-lime-200 text-[#171b17] hover:bg-lime-100',
        secondary: 'border border-white/12 bg-white/[0.055] text-white hover:bg-white/[0.1]',
        quiet: 'text-[#b9c0b9] hover:bg-white/[0.07] hover:text-white',
        danger: 'border border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15'
      },
      size: {
        default: 'px-4 py-2.5',
        small: 'min-h-8 px-3 py-1.5 text-xs',
        icon: 'size-9 p-0'
      }
    },
    defaultVariants: { variant: 'primary', size: 'default' }
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn('field-control h-10 px-3.5', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('field-control min-h-28 resize-y px-3.5 py-3 leading-6', className)} {...props} />;
}

export function Select({ className, children, ...props }: InputHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('field-control h-10 px-3.5', className)} {...props}>{children}</select>;
}

export function Toggle({ checked, onCheckedChange, disabled, id }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="switch-root"
    >
      <SwitchPrimitive.Thumb className="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label className="field-label" htmlFor={htmlFor}>
      <span>{children}</span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('panel', className)} {...props}>{children}</section>;
}

export function Status({ state, children }: { state: 'healthy' | 'warning' | 'error' | 'neutral'; children: ReactNode }) {
  return <span className={`status status-${state}`}><i aria-hidden="true" />{children}</span>;
}

export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingLine({ className }: { className?: string }) {
  return <div className={cn('loading-line', className)} aria-label="Loading" />;
}