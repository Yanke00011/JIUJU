import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DatePicker,
  Input,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import { adminApi } from "../../services/admin";
import type { AdminDrinkItem } from "../../services/admin";

const { RangePicker } = DatePicker;

export default function AdminDrinks() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [roomId, setRoomId] = useState("");
  const [userId, setUserId] = useState("");
  const [productId, setProductId] = useState("");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin",
      "drinks",
      page,
      pageSize,
      roomId,
      userId,
      productId,
      range,
    ],
    queryFn: () =>
      adminApi.drinks.list({
        page,
        pageSize,
        roomId: roomId || undefined,
        userId: userId || undefined,
        productId: productId || undefined,
        startDate: range?.[0]?.toISOString(),
        endDate: range?.[1]?.toISOString(),
      }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => adminApi.drinks.restore(id),
    onSuccess: () => {
      message.success("记录已恢复");
      queryClient.invalidateQueries({ queryKey: ["admin", "drinks"] });
    },
  });

  const columns = [
    {
      title: "用户",
      key: "user",
      render: (_: unknown, r: AdminDrinkItem) =>
        r.user?.nickname || r.user?.username || "-",
    },
    {
      title: "酒品",
      key: "product",
      render: (_: unknown, r: AdminDrinkItem) => r.product?.name || "-",
    },
    {
      title: "数量",
      dataIndex: "quantity",
      key: "quantity",
      render: (v: number) => `${v} 瓶`,
    },
    {
      title: "容量快照",
      dataIndex: "volumeMlSnapshot",
      key: "volumeMlSnapshot",
      render: (v: number) => `${v} ml`,
    },
    {
      title: "房间",
      key: "room",
      render: (_: unknown, r: AdminDrinkItem) => r.room?.name || "-",
    },
    {
      title: "登记人",
      key: "createdBy",
      render: (_: unknown, r: AdminDrinkItem) =>
        r.createdByUser?.nickname || "-",
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
    {
      title: "状态",
      key: "status",
      render: (_: unknown, r: AdminDrinkItem) =>
        r.deletedAt ? (
          <Tag color="red">已删除</Tag>
        ) : (
          <Tag color="green">正常</Tag>
        ),
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, r: AdminDrinkItem) =>
        r.deletedAt ? (
          <Popconfirm
            title="确定恢复该记录？"
            onConfirm={() => restoreMutation.mutate(r.id)}
          >
            <Button
              size="small"
              type="primary"
              ghost
              loading={restoreMutation.isPending}
            >
              恢复
            </Button>
          </Popconfirm>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
  ];

  return (
    <div>
      <Typography.Title level={2} className="admin-page-title">饮酒记录管理</Typography.Title>

      <div className="admin-toolbar"><Space wrap>
        <Input
          placeholder="房间 ID"
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setRoomId(e.target.value)}
        />
        <Input
          placeholder="用户 ID"
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setUserId(e.target.value)}
        />
        <Input
          placeholder="商品 ID"
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setProductId(e.target.value)}
        />
        <RangePicker showTime onChange={(v) => setRange(v)} />
        <Button
          onClick={() => {
            setRoomId("");
            setUserId("");
            setProductId("");
            setRange(null);
            setPage(1);
          }}
        >
          重置
        </Button>
      </Space></div>

      <Table<AdminDrinkItem>
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
        scroll={{ x: 900 }}
      />
    </div>
  );
}
