import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { adminApi } from "../../services/admin";
import type { AdminLogItem } from "../../services/admin";

const ACTION_LABEL: Record<string, string> = {
  USER_STATUS_UPDATE: "修改用户状态",
  USER_ROLE_UPDATE: "修改用户角色",
  PRODUCT_CREATE: "新增商品",
  PRODUCT_UPDATE: "修改商品",
  PRODUCT_DELETE: "删除商品",
  USER_DELETE: "删除用户",
  USER_SOFT_DELETE: "软删除用户",
  ROOM_END_REQUEST: "结束房间",
  ROOM_END_CANCEL: "撤销结束",
  ROOM_FINALIZED: "酒局归档",
  DRINK_RECORD_RESTORE: "恢复饮酒记录",
  PRODUCT_BATCH_DELETE: "批量删除商品",
};

type ViewMode = "table" | "timeline";

export default function AdminLogs() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [targetType, setTargetType] = useState<string | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("table");

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
            { value: "USER_ROLE_UPDATE", label: "修改用户角色" },
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
        <Segmented
          value={view}
          onChange={(v) => setView(v as ViewMode)}
          options={[
            { label: "表格", value: "table" },
            { label: "时间线", value: "timeline" },
          ]}
        />
      </Space></div>

      {view === "timeline" && (
        <Card className="log-timeline" style={{ marginBottom: 12 }}>
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (data?.items ?? []).length === 0 ? (
            <Empty description="暂无日志" />
          ) : (
            <Timeline
              items={(data?.items ?? []).map((r) => ({
                color: r.action?.includes("DELETE") ? "red" : "blue",
                children: (
                  <div className="log-timeline-item-head">
                    <Typography.Text strong>
                      {r.admin?.username || "-"}
                    </Typography.Text>
                    <Tag color="blue">
                      {ACTION_LABEL[r.action] || r.action}
                    </Tag>
                    <span className="log-timeline-time">
                      {new Date(r.createdAt).toLocaleString("zh-CN")}
                    </span>
                    <Button
                      size="small"
                      type="link"
                      style={{ padding: 0 }}
                      onClick={() => setDetailId(r.id)}
                    >
                      详情
                    </Button>
                  </div>
                ),
              }))}
            />
          )}
          <div style={{ textAlign: "right", marginTop: 8 }}>
            <Pagination
              size="small"
              current={page}
              pageSize={pageSize}
              total={data?.total ?? 0}
              showSizeChanger
              pageSizeOptions={[10, 20, 50, 100]}
              onChange={(p, ps) => {
                setPage(p);
                setPageSize(ps);
              }}
            />
          </div>
        </Card>
      )}

      {view === "table" && (
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
      )}

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
