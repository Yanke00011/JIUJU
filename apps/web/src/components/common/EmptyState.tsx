import { Empty } from "antd";
import type { ReactNode } from "react";

interface EmptyStateProps {
  description: string;
  hint?: string;
  action?: ReactNode;
}

/** 友好空状态：说明 + 可选提示 + 可选操作 */
export default function EmptyState({
  description,
  hint,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={description}
      >
        {hint && <p className="empty-state-hint">{hint}</p>}
        {action && <div className="empty-state-action">{action}</div>}
      </Empty>
    </div>
  );
}
