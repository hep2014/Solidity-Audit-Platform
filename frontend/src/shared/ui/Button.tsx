import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export function Button({
  className,
  variant = "primary",
  icon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx("button", `button-${variant}`, className)}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="button-icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}