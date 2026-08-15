import { Card } from "antd";
import type { ReactNode } from "react";

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  accent?: "wine" | "gold" | "green";
  suffix?: string;
}

/** 数据统计卡：图标 + 数值 + 说明，accent 控制强调色 */
export default function StatCard({
  icon,
  label,
  value,
  suffix,
  accent = "wine",
}: StatCardProps) {
  return (
    <Card
      className={`stat-card stat-card-${accent}`}
      styles={{ body: { padding: "16px 18px" } }}
    >
      {icon && <span className="stat-card-icon">{icon}</span>}
      <div className="stat-card-text">
        <span className="stat-card-value">
          {value}
          {suffix && <em className="stat-card-suffix">{suffix}</em>}
        </span>
        <span className="stat-card-label">{label}</span>
      </div>
    </Card>
  );
}
