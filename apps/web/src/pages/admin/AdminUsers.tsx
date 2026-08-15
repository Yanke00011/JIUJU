import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Drawer,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useAuthStore } from "../../store/auth";
import { adminApi } from "../../services/admin";
import type { AdminUser } from "../../services/admin";

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detail, setDetail] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", page, pageSize],
    queryFn: () => adminApi.users.list(page, pageSize),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminUser["status"] }) =>
      adminApi.users.updateStatus(id, status),
    onSuccess: () => {
      message.success("状态已更新");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const columns = [
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
      render: (_: string, record: AdminUser) => (
        <a onClick={() => setDetail(record)}>{record.username}</a>
      ),
    },
    { title: "昵称", dataIndex: "nickname", key: "nickname" },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (role: AdminUser["role"]) => (
        <Tag color={role === "SUPER_ADMIN" ? "volcano" : role === "ADMIN" ? "orange" : "default"}>
          {role === "SUPER_ADMIN" ? "超级管理员" : role === "ADMIN" ? "管理员" : "普通用户"}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: AdminUser["status"]) => (
        <Tag color={status === "ACTIVE" ? "green" : "red"}>
          {status === "ACTIVE" ? "正常" : "已禁用"}
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
      render: (_: unknown, record: AdminUser) => {
        if (record.id === currentUserId) {
          return <Typography.Text type="secondary">当前账号</Typography.Text>;
        }
        return record.status === "ACTIVE" ? (
          <Popconfirm
            title="确定禁用该用户？"
            onConfirm={() =>
              statusMutation.mutate({ id: record.id, status: "DISABLED" })
            }
          >
            <Button size="small" danger loading={statusMutation.isPending}>
              禁用
            </Button>
          </Popconfirm>
        ) : (
          <Button
            size="small"
            type="primary"
            ghost
            loading={statusMutation.isPending}
            onClick={() => statusMutation.mutate({ id: record.id, status: "ACTIVE" })}
          >
            恢复
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        用户管理
      </Typography.Title>

      <Table<AdminUser>
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
        title="用户详情"
        open={!!detail}
        onClose={() => setDetail(null)}
        width={360}
      >
        {detail && (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div>
              <Typography.Text type="secondary">用户名：</Typography.Text>
              {detail.username}
            </div>
            <div>
              <Typography.Text type="secondary">昵称：</Typography.Text>
              {detail.nickname}
            </div>
            <div>
              <Typography.Text type="secondary">角色：</Typography.Text>
              {detail.role}
            </div>
            <div>
              <Typography.Text type="secondary">状态：</Typography.Text>
              {detail.status}
            </div>
            <div>
              <Typography.Text type="secondary">创建时间：</Typography.Text>
              {new Date(detail.createdAt).toLocaleString("zh-CN")}
            </div>
            <div>
              <Typography.Text type="secondary">最后登录：</Typography.Text>
              {detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString("zh-CN") : "-"}
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
