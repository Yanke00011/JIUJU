import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Descriptions,
  Drawer,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { adminApi } from "../../services/admin";
import type { AdminRoomItem } from "../../services/admin";

export default function AdminRooms() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "rooms", page, pageSize],
    queryFn: () => adminApi.rooms.list(page, pageSize),
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "rooms", "detail", detailId],
    queryFn: () => adminApi.rooms.get(detailId!),
    enabled: !!detailId,
  });

  const columns = [
    { title: "房间名称", dataIndex: "name", key: "name" },
    {
      title: "房主",
      key: "owner",
      render: (_: unknown, r: AdminRoomItem) => r.owner?.nickname || r.owner?.username || "-",
    },
    { title: "成员数", dataIndex: "memberCount", key: "memberCount" },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: AdminRoomItem["status"]) => (
        <Tag color={status === "ACTIVE" ? "green" : "default"}>
          {status === "ACTIVE" ? "进行中" : "已结束"}
        </Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, r: AdminRoomItem) => (
        <Button size="small" onClick={() => setDetailId(r.id)}>
          详情
        </Button>
      ),
    },
  ];

  const detail = detailQuery.data;

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        房间管理
      </Typography.Title>

      <Table<AdminRoomItem>
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

      <Drawer
        title={detail ? detail.name : "房间详情"}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        width={400}
      >
        {detailQuery.isLoading && <Typography.Text>加载中...</Typography.Text>}
        {detail && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="房主">
                {detail.owner?.nickname || detail.owner?.username || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.status === "ACTIVE" ? "进行中" : "已结束"}
              </Descriptions.Item>
              <Descriptions.Item label="成员数">{detail.memberCount}</Descriptions.Item>
              <Descriptions.Item label="饮酒记录数">{detail.drinkRecordCount}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(detail.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
              {detail.endedAt && (
                <Descriptions.Item label="结束时间">
                  {new Date(detail.endedAt).toLocaleString("zh-CN")}
                </Descriptions.Item>
              )}
            </Descriptions>

            <div>
              <Typography.Text strong>统计摘要</Typography.Text>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <Statistic title="总数量" value={detail.stats.totalQuantity} />
                <Statistic title="总容量 ml" value={detail.stats.totalVolumeMl} />
                <Statistic title="总酒精 ml" value={detail.stats.totalAlcoholMl} />
              </div>
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
