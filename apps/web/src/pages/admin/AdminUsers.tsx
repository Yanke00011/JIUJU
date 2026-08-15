import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Drawer,
  Input,
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
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [detail, setDetail] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", page, pageSize, keyword],
    queryFn: () =>
      adminApi.users.list({ page, pageSize, keyword: keyword || undefined }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "users", "detail", detail?.id],
    queryFn: () => adminApi.users.get(detail!.id),
    enabled: !!detail?.id,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminUser["status"] }) =>
      adminApi.users.updateStatus(id, status),
    onSuccess: () => {
      message.success("状态已更新");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.users.remove(id),
    onSuccess: (result) => {
      message.success(
        result.softDeleted ? "用户已软删除（存在历史数据）" : "用户已删除",
      );
      setDetail(null);
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
        <Tag
          color={
            role === "SUPER_ADMIN"
              ? "volcano"
              : role === "ADMIN"
                ? "orange"
                : "default"
          }
        >
          {role === "SUPER_ADMIN"
            ? "超级管理员"
            : role === "ADMIN"
              ? "管理员"
              : "普通用户"}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: AdminUser["status"], record: AdminUser) => (
        <Tag
          color={
            record.deletedAt ? "red" : status === "ACTIVE" ? "green" : "red"
          }
        >
          {record.deletedAt
            ? "已删除"
            : status === "ACTIVE"
              ? "正常"
              : "已禁用"}
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
        if (record.id === currentUser?.id) {
          return <Typography.Text type="secondary">当前账号</Typography.Text>;
        }
        return (
          <Space>
            {record.status === "ACTIVE" && !record.deletedAt ? (
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
              !record.deletedAt && (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  loading={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({ id: record.id, status: "ACTIVE" })
                  }
                >
                  恢复
                </Button>
              )
            )}
            {isSuperAdmin && !record.deletedAt && (
              <Popconfirm
                title="确定删除该用户？有历史数据将软删除"
                onConfirm={() => deleteMutation.mutate(record.id)}
              >
                <Button
                  size="small"
                  type="text"
                  danger
                  loading={deleteMutation.isPending}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Typography.Title level={2} className="admin-page-title">用户管理</Typography.Title>

      <div className="admin-toolbar"><Input.Search
        placeholder="搜索用户名 / 昵称"
        allowClear
        style={{ maxWidth: 320, marginBottom: 12 }}
        onSearch={(v) => {
          setKeyword(v);
          setPage(1);
        }}
      /></div>

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

      <Drawer className="drawer-detail"
        title="用户详情"
        open={!!detail}
        onClose={() => setDetail(null)}
        width={360}
      >
        {detailQuery.isLoading && <Typography.Text>加载中...</Typography.Text>}
        {detailQuery.data && (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div>
              <Typography.Text type="secondary">用户名：</Typography.Text>
              {detailQuery.data.username}
            </div>
            <div>
              <Typography.Text type="secondary">昵称：</Typography.Text>
              {detailQuery.data.nickname}
            </div>
            <div>
              <Typography.Text type="secondary">角色：</Typography.Text>
              {detailQuery.data.role}
            </div>
            <div>
              <Typography.Text type="secondary">状态：</Typography.Text>
              {detailQuery.data.deletedAt ? "已删除" : detailQuery.data.status}
            </div>
            <div>
              <Typography.Text type="secondary">注册时间：</Typography.Text>
              {new Date(detailQuery.data.createdAt).toLocaleString("zh-CN")}
            </div>
            <div>
              <Typography.Text type="secondary">最后登录：</Typography.Text>
              {detailQuery.data.lastLoginAt
                ? new Date(detailQuery.data.lastLoginAt).toLocaleString("zh-CN")
                : "-"}
            </div>
            <div>
              <Typography.Text type="secondary">参与房间数：</Typography.Text>
              {detailQuery.data.roomCount}
            </div>
            <div>
              <Typography.Text type="secondary">饮酒记录数：</Typography.Text>
              {detailQuery.data.drinkRecordCount}
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
