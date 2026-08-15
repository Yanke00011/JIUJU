import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { adminApi } from "../../services/admin";
import type { AdminProduct } from "../../services/admin";

const CATEGORY_LABEL: Record<string, string> = {
  BAIJIU: "白酒",
  BEER: "啤酒",
  RED_WINE: "红酒",
  WHITE_WINE: "白葡萄酒",
  SPIRITS: "烈酒",
  COCKTAIL: "鸡尾酒",
  OTHER: "其他",
};

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", page, pageSize],
    queryFn: () => adminApi.products.list(page, pageSize),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<AdminProduct>) =>
      adminApi.products.update(editing!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const handleEdit = (record: AdminProduct) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      brand: record.brand ?? "",
      category: record.category,
      volumeMl: record.volumeMl,
      alcoholPercent: record.alcoholPercent ?? undefined,
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await updateMutation.mutateAsync({
      name: values.name,
      brand: values.brand || null,
      category: values.category,
      volumeMl: values.volumeMl,
      alcoholPercent: values.alcoholPercent ?? null,
    });
    setEditing(null);
  };

  const columns = [
    { title: "条码", dataIndex: "barcode", key: "barcode" },
    { title: "名称", dataIndex: "name", key: "name" },
    {
      title: "品牌",
      dataIndex: "brand",
      key: "brand",
      render: (v: string | null) => v || "-",
    },
    {
      title: "分类",
      dataIndex: "category",
      key: "category",
      render: (v: string) => CATEGORY_LABEL[v] || v,
    },
    { title: "容量 ml", dataIndex: "volumeMl", key: "volumeMl" },
    {
      title: "酒精度 %",
      dataIndex: "alcoholPercent",
      key: "alcoholPercent",
      render: (v: number | null) => (v === null ? "-" : v),
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, record: AdminProduct) => (
        <Button size="small" onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        商品管理
      </Typography.Title>

      <Table<AdminProduct>
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

      <Modal
        title="编辑商品"
        open={!!editing}
        onOk={handleSubmit}
        onCancel={() => setEditing(null)}
        confirmLoading={updateMutation.isPending}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="brand" label="品牌">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: "请选择分类" }]}>
            <Select
              options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Space style={{ width: "100%" }} align="start">
            <Form.Item
              name="volumeMl"
              label="容量 ml"
              rules={[{ required: true, message: "请输入容量" }]}
            >
              <InputNumber min={1} max={10000} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="alcoholPercent" label="酒精度 %">
              <InputNumber min={0} max={100} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
