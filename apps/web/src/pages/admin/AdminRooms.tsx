import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Descriptions,
  Drawer,
  Input,
  List,
  message,
  Popconfirm,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useAuthStore } from "../../store/auth";
import { adminApi } from "../../services/admin";
import type { AdminRoomItem, AdminDrinkItem } from "../../services/admin";

export default function AdminRooms() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [drinkPage, setDrinkPage] = useState(1);
  const isAdmin = useAuthStore(
    (state) =>
      state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN",
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "rooms", page, pageSize, keyword],
    queryFn: () =>
      adminApi.rooms.list({ page, pageSize, keyword: keyword || undefined }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "rooms", "detail", detailId],
    queryFn: () => adminApi.rooms.get(detailId!),
    enabled: !!detailId,
  });

  const membersQuery = useQuery({
    queryKey: ["admin", "rooms", "members", detailId],
    queryFn: () => adminApi.rooms.members(detailId!),
    enabled: !!detailId,
  });

  const drinksQuery = useQuery({
    queryKey: ["admin", "rooms", "drinks", detailId, drinkPage],
    queryFn: () =>
      adminApi.rooms.drinks(detailId!, { page: drinkPage, pageSize: 10 }),
    enabled: !!detailId,
  });

  const handleEnd = async (roomId: string) => {
    try {
      await adminApi.rooms.end(roomId);
      message.success("房间已结束");
      queryClient.invalidateQueries({ queryKey: ["admin", "rooms"] });
      if (detailId === roomId) {
        queryClient.invalidateQueries({
          queryKey: ["admin", "rooms", "detail", roomId],
        });
      }
    } catch {
      // 错误由拦截器提示
    }
  };

  const handleExport = (roomId: string) => {
    const token = localStorage.getItem("jiuju-auth");
    const auth = token ? (JSON.parse(token).state?.token as string) : "";
    const url = `/api/admin/rooms/${roomId}/export`;
    fetch(url, { headers: { Authorization: `Bearer ${auth}` } })
      .then((res) => {
        if (!res.ok) throw new Error("导出失败");
        return res.text();
      })
      .then((text) => {
        const blob = new Blob(["\uFEFF" + text], {
          type: "text/csv;charset=utf-8",
        });
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `room-${roomId}-drinks.csv`;
        a.click();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => message.error("导出失败"));
  };

  const columns = [
    { title: "房间名称", dataIndex: "name", key: "name" },
    {
      title: "房主",
      key: "owner",
      render: (_: unknown, r: AdminRoomItem) =>
        r.owner?.nickname || r.owner?.username || "-",
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
        <Space>
          <Button
            size="small"
            onClick={() => {
              setDrinkPage(1);
              setDetailId(r.id);
            }}
          >
            详情
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleExport(r.id)}
          >
            导出
          </Button>
          {isAdmin && r.status === "ACTIVE" && (
            <Popconfirm
              title="确定结束该房间？"
              onConfirm={() => handleEnd(r.id)}
            >
              <Button size="small" danger>
                结束
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const detail = detailQuery.data;
  const members = membersQuery.data ?? [];
  const drinks = drinksQuery.data;

  return (
    <div>
      <Typography.Title level={2} className="admin-page-title">房间管理</Typography.Title>

      <div className="admin-toolbar"><Input.Search
        placeholder="搜索名称 / 邀请码 / 房主"
        allowClear
        style={{ maxWidth: 320, marginBottom: 12 }}
        onSearch={(v) => {
          setKeyword(v);
          setPage(1);
        }}
      /></div>

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
        scroll={{ x: 720 }}
      />

      <Drawer className="drawer-detail"
        title={detail ? detail.name : "房间详情"}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        width={420}
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
              <Descriptions.Item label="成员数">
                {detail.memberCount}
              </Descriptions.Item>
              <Descriptions.Item label="饮酒记录数">
                {detail.drinkRecordCount}
              </Descriptions.Item>
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
                <Statistic
                  title="总容量 ml"
                  value={detail.stats.totalVolumeMl}
                />
                <Statistic
                  title="总酒精 ml"
                  value={detail.stats.totalAlcoholMl}
                />
              </div>
            </div>

            <div>
              <Typography.Text strong>成员列表</Typography.Text>
              <List
                size="small"
                dataSource={members}
                renderItem={(m) => (
                  <List.Item style={{ padding: "6px 0" }}>
                    {m.nickname}
                    {m.role === "OWNER" && (
                      <Tag color="gold" style={{ marginLeft: 8 }}>
                        房主
                      </Tag>
                    )}
                  </List.Item>
                )}
              />
            </div>

            <div>
              <Typography.Text strong>饮酒记录（含已删除）</Typography.Text>
              <List
                size="small"
                loading={drinksQuery.isLoading}
                dataSource={drinks?.items ?? []}
                pagination={{
                  current: drinkPage,
                  pageSize: 10,
                  total: drinks?.total ?? 0,
                  onChange: setDrinkPage,
                  size: "small",
                }}
                renderItem={(d: AdminDrinkItem) => (
                  <List.Item style={{ padding: "6px 0" }}>
                    <div style={{ fontSize: 13 }}>
                      {d.user?.nickname || "?"} · {d.product?.name || "?"} ·{" "}
                      {d.quantity}瓶
                      <br />
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
                        {new Date(d.createdAt).toLocaleString("zh-CN")}
                      </Typography.Text>
                      {d.deletedAt && (
                        <Tag color="red" style={{ marginLeft: 8 }}>
                          已删除
                        </Tag>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
