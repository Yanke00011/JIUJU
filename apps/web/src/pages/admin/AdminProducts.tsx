import { useRef, useState } from "react";
import type { Key } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import {
  CameraOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../../store/auth";
import { adminApi } from "../../services/admin";
import { BarcodeScanner, type BarcodeScannerHandle } from "../../components/BarcodeScanner";
import type { AdminProduct, BatchDeleteResult } from "../../services/admin";

const CATEGORY_LABEL: Record<string, string> = {
  BAIJIU: "白酒",
  BEER: "啤酒",
  RED_WINE: "红酒",
  WHITE_WINE: "白葡萄酒",
  SPIRITS: "烈酒",
  COCKTAIL: "鸡尾酒",
  OTHER: "其他",
};

const BARCODE_PATTERN = /^\d{8,14}$/;

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const isSuperAdmin = useAuthStore(
    (state) => state.user?.role === "SUPER_ADMIN",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [batchResult, setBatchResult] = useState<BatchDeleteResult | null>(
    null,
  );
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanResult, setScanResult] = useState<AdminProduct | null>(null);
  const scannerRef = useRef<BarcodeScannerHandle>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", page, pageSize, keyword],
    queryFn: () =>
      adminApi.products.list({ page, pageSize, keyword: keyword || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      barcode: string;
      name: string;
      brand?: string;
      category: string;
      volumeMl: number;
      alcoholPercent?: number;
    }) => adminApi.products.create(payload),
    onSuccess: () => {
      message.success("商品已创建");
      setCreating(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<AdminProduct>) =>
      adminApi.products.update(editing!.id, payload),
    onSuccess: () => {
      message.success("商品已更新");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.products.remove(id),
    onSuccess: () => {
      message.success("商品已删除");
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.products.batchDelete(ids),
    onSuccess: (result) => {
      setBatchResult(result);
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const openEdit = (record: AdminProduct) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      brand: record.brand ?? "",
      category: record.category,
      volumeMl: record.volumeMl,
      alcoholPercent: record.alcoholPercent ?? undefined,
    });
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    createMutation.mutate({
      barcode: values.barcode,
      name: values.name,
      brand: values.brand || undefined,
      category: values.category,
      volumeMl: values.volumeMl,
      alcoholPercent: values.alcoholPercent ?? undefined,
    });
  };

  const handleUpdate = async () => {
    const values = await form.validateFields();
    updateMutation.mutate({
      name: values.name,
      brand: values.brand || null,
      category: values.category,
      volumeMl: values.volumeMl,
      alcoholPercent: values.alcoholPercent ?? null,
    });
  };

  const openScanModal = () => {
    setScanResult(null);
    setScanModalOpen(true);
  };

  const closeScanModal = () => {
    setScanModalOpen(false);
    setScanResult(null);
  };

  /**
   * 管理员扫码录入：
   * 已存在 → 提示并支持「查看商品」；不存在 → 关闭扫码窗口并自动填入 barcode。
   */
  const handleAdminScan = async (code: string) => {
    try {
      const page = await adminApi.products.list({
        keyword: code,
        page: 1,
        pageSize: 5,
      });
      const found = page.items.find((p) => p.barcode === code);
      if (found) {
        setScanResult(found);
        message.warning("该商品已存在，请勿重复创建");
        return;
      }
      // 不存在：自动填入新增表单
      setScanModalOpen(false);
      setScanResult(null);
      setCreating(true);
      form.resetFields();
      form.setFieldsValue({ barcode: code });
      message.success("该条码尚未录入，已自动填入，请完善商品信息");
    } catch {
      message.error("网络异常，请重试");
    }
  };

  const viewScannedProduct = () => {
    if (!scanResult) return;
    setScanModalOpen(false);
    setScanResult(null);
    setKeyword(scanResult.barcode);
    setPage(1);
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
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          {isSuperAdmin && (
            <Popconfirm
              title="确定删除该商品？"
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
      ),
    },
  ];

  const isModalOpen = creating || !!editing;

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Typography.Title level={2} className="admin-page-title">
          商品管理
        </Typography.Title>
        <Space>
          <Button icon={<CameraOutlined />} onClick={openScanModal}>
            扫码录入
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCreating(true);
              form.resetFields();
            }}
          >
            新增商品
          </Button>
        </Space>
      </div>

      <div className="admin-toolbar">
        <Input.Search
          placeholder="搜索条码 / 名称 / 品牌"
          allowClear
          style={{ maxWidth: 320 }}
          onSearch={(v) => {
            setKeyword(v);
            setPage(1);
          }}
        />
        {isSuperAdmin && (
          <Popconfirm
            title={`确定删除选中的 ${selectedRowKeys.length} 个商品？被引用商品将被跳过。`}
            disabled={selectedRowKeys.length === 0}
            onConfirm={() =>
              batchDeleteMutation.mutate(selectedRowKeys as string[])
            }
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
              loading={batchDeleteMutation.isPending}
            >
              批量删除
              {selectedRowKeys.length > 0
                ? `（${selectedRowKeys.length}）`
                : ""}
            </Button>
          </Popconfirm>
        )}
      </div>

      <Table<AdminProduct>
        rowKey="id"
        size="small"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        rowSelection={isSuperAdmin ? rowSelection : undefined}
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
        title={creating ? "新增商品" : "编辑商品"}
        open={isModalOpen}
        onOk={creating ? handleCreate : handleUpdate}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        confirmLoading={
          creating ? createMutation.isPending : updateMutation.isPending
        }
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {creating && (
            <Form.Item
              name="barcode"
              label="条形码"
              rules={[
                { required: true, message: "请输入条形码" },
                {
                  pattern: BARCODE_PATTERN,
                  message: "条形码需为 8-14 位数字（EAN-13 / EAN-8）",
                },
              ]}
            >
              <Input maxLength={14} placeholder="如 6901234567890" />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: "请输入名称" }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="brand" label="品牌">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: "请选择分类" }]}
          >
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

      <Modal
        title="扫码录入商品"
        open={scanModalOpen}
        onCancel={closeScanModal}
        footer={null}
        destroyOnHidden
      >
        {scanModalOpen && !scanResult && (
          <BarcodeScanner
            ref={scannerRef}
            onScanSuccess={handleAdminScan}
          />
        )}

        {scanModalOpen && scanResult && (
          <div>
            <Typography.Paragraph type="warning">
              该商品已存在，无需重复创建。
            </Typography.Paragraph>
            <Card size="small" style={{ marginBottom: 12 }}>
              <Descriptions column={1} size="small" labelStyle={{ width: 80 }}>
                <Descriptions.Item label="名称">
                  {scanResult.name}
                </Descriptions.Item>
                <Descriptions.Item label="品牌">
                  {scanResult.brand || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="条码">
                  {scanResult.barcode}
                </Descriptions.Item>
                <Descriptions.Item label="容量">
                  {scanResult.volumeMl} ml
                </Descriptions.Item>
                <Descriptions.Item label="酒精度">
                  {scanResult.alcoholPercent !== null
                    ? `${scanResult.alcoholPercent}%`
                    : "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <Space style={{ width: "100%" }}>
              <Button block onClick={closeScanModal}>
                关闭
              </Button>
              <Button type="primary" block onClick={viewScannedProduct}>
                查看商品
              </Button>
            </Space>
          </div>
        )}
      </Modal>

      <Modal
        title="批量删除结果"
        open={!!batchResult}
        onCancel={() => setBatchResult(null)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setBatchResult(null)}
          >
            知道了
          </Button>,
        ]}
      >
        {batchResult && (
          <div>
            <Typography.Paragraph>
              成功删除 <b>{batchResult.successCount}</b> 个商品；失败{" "}
              <b>{batchResult.failCount}</b> 个。
            </Typography.Paragraph>
            {batchResult.failed.length > 0 && (
              <>
                <Typography.Text strong>失败列表：</Typography.Text>
                <ul style={{ marginTop: 8, paddingLeft: 20, color: "#cf1322" }}>
                  {batchResult.failed.map((f) => (
                    <li key={f.id} style={{ marginBottom: 4, fontSize: 13 }}>
                      {f.message}（{f.id.slice(0, 8)}…）
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
