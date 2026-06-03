import clsx from "clsx";

interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  active?: boolean;
}

export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  label,
  active = false
}: ProgressRingProps) {
  const normalized = Math.max(0, Math.min(100, value || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div className={clsx("progress-ring", { "progress-ring-active": active })}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="progress-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>

      <div className="progress-ring-content">
        <strong>{normalized}%</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}