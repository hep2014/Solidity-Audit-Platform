import type { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
}

interface CardHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function Card({ children, className }: CardProps) {
  return <section className={clsx("card", className)}>{children}</section>;
}

export function CardHeader({
  eyebrow,
  title,
  description,
  action
}: CardHeaderProps) {
  return (
    <div className="card-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>

      {action && <div className="card-header-action">{action}</div>}
    </div>
  );
}