import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Descriptions,
  Drawer,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { adminApi } from "../../services/admin";
import type { AdminLogItem } from "../../services/admin";

export default function AdminLogs() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [targetType, setTargetType] = useState<string | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "logs", page, pageSize, action, targetType],
    queryFn: () =>
      adminApi.logs.list({
        page,
        pageSize,
        action: action || undefined,
        targetType: targetType || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "logs", "detail", detailId],
    queryFn: () => adminApi.logs.get(detailId!),
    enabled: !!detailId,
  });

  const columns = [
    {
      title: "管理员",
      key: "admin",
      render: (_: unknown, r: AdminLogItem) => r.admin?.username || "-",
    },
    { title: "操作", dataIndex: "action", key: "action" },
    { title: "对象类型", dataIndex: "targetType", key: "targetType" },
    {
      title: "目标 ID",
      dataIndex: "targetId",
      key: "targetId",
      ellipsis: true,
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actionBtn",
      render: (_: unknown, r: AdminLogItem) => (
        <Button size="small" onClick={() => setDetailId(r.id)}>
          详情
        </Button>
      ),
    },
  ];

  const detail = detailQuery.data;

  return (
    <div>
      <Typography.Title level={2} className="admin-page-title">操作日志</Typography.Title>

      <div className="admin-toolbar"><Space wrap>
        <Select
          allowClear
          placeholder="按操作过滤"
          style={{ width: 160 }}
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          options={[
            { value: "USER_STATUS_UPDATE", label: "修改用户状态" },
            { value: "PRODUCT_UPDATE", label: "修改商品" },
          ]}
        />
        <Select
          allowClear
          placeholder="按对象过滤"
          style={{ width: 140 }}
          value={targetType}
          onChange={(v) => {
            setTargetType(v);
            setPage(1);
          }}
          options={[
            { value: "User", label: "用户" },
            { value: "Product", label: "商品" },
          ]}
        />
      </Space></div>

      <Table<AdminLogItem>
        rowKey="id"
        size="small"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 640 }}
      />

      <Drawer className="drawer-detail"
        title="日志详情"
        open={!!detailId}
        onClose={() => setDetailId(null)}
        width={420}
      >
        {detailQuery.isLoading && <Typography.Text>加载中...</Typography.Text>}
        {detail && (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="管理员">
                {detail.admin?.username || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="操作">
                <Tag color="blue">{detail.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="对象类型">
                {detail.targetType}
              </Descriptions.Item>
              <Descriptions.Item label="目标 ID">
                {detail.targetId}
              </Descriptions.Item>
              <Descriptions.Item label="IP">
                {detail.ip || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="User-Agent">
                {detail.userAgent || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="时间">
                {new Date(detail.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text strong>详情 JSON</Typography.Text>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 13,
                  overflow: "auto",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                {JSON.stringify(detail.details ?? {}, null, 2)}
              </pre>
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
