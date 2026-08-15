import { Space, Typography } from "antd";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}

/** 页面标题区：标题 + 副标题 + 右侧操作（移动端自动换行） */
export default function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div className="page-heading">
      <div>
        <Typography.Title level={2} className="page-title">
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Paragraph className="page-subtitle">
            {subtitle}
          </Typography.Paragraph>
        )}
      </div>
      {extra && <Space wrap>{extra}</Space>}
    </div>
  );
}
