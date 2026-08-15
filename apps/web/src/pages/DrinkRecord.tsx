import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Result,
  Segmented,
  Space,
  Spin,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  SearchOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { BarcodeScanner, type BarcodeScannerHandle } from "../components/BarcodeScanner";
import { productsApi } from "../services/products";
import { drinksApi } from "../services/drinks";
import { useAuthStore } from "../store/auth";
import type { Product } from "../types/api";

type AddMode = "scan" | "select";

type QueryState =
  | "idle"
  | "loading"
  | "success"
  | "not-found"
  | "network-error";

/** 同一 barcode 禁止重复查询的时间窗口（毫秒） */
const DEDUP_WINDOW_MS = 3000;

export default function DrinkRecord() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  const scannerRef = useRef<BarcodeScannerHandle>(null);
  const scanRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBarcodeRef = useRef(""); // 手动输入防重
  const lastScanTimeRef = useRef(0);

  const [mode, setMode] = useState<AddMode>("scan");
  const [queryState, setQueryState] = useState<QueryState>("idle");
  const [barcode, setBarcode] = useState<string>("");
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [lastQueryManual, setLastQueryManual] = useState(false);

  // ===== 选择已有酒品：搜索（防抖）=====
  const [selectKeyword, setSelectKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(selectKeyword.trim()), 300);
    return () => clearTimeout(t);
  }, [selectKeyword]);

  const selectQuery = useQuery({
    queryKey: ["products", "search", debouncedKeyword],
    queryFn: () => productsApi.search(debouncedKeyword, { page: 1, pageSize: 50 }),
    enabled: debouncedKeyword.length > 0,
  });

  // ===== 扫码查询商品 =====
  const productQuery = useMutation({
    mutationFn: (code: string) => productsApi.findByBarcode(code),
    onMutate: () => {
      setQueryState("loading");
      setProduct(null);
    },
    onSuccess: (p) => {
      setProduct(p);
      setQueryState("success");
    },
    onError: (error) => {
      setProduct(null);
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        setQueryState("not-found");
      } else {
        setQueryState("network-error");
      }
      // 稍后复位并重启摄像头继续扫描
      if (scanRetryTimer.current) clearTimeout(scanRetryTimer.current);
      scanRetryTimer.current = setTimeout(() => {
        setQueryState("idle");
        scannerRef.current?.start();
      }, 1800);
    },
  });

  // ===== 登记（扫码 / 选择已有酒品共用同一接口）=====
  const createMutation = useMutation({
    mutationFn: () => drinksApi.create(id, product!.id, userId!, quantity),
    onSuccess: () => {
      message.success("登记成功");
      queryClient.invalidateQueries({ queryKey: ["room-statistics", id] });
      queryClient.invalidateQueries({ queryKey: ["drinks", id] });
      setProduct(null);
      setBarcode("");
      setQuantity(1);
      setQueryState("idle");
    },
  });

  const handleScanSuccess = useCallback((code: string) => {
    setLastQueryManual(false);
    setBarcode(code);
    productQuery.mutate(code);
  }, [productQuery]);

  const handleBarcodeSubmit = () => {
    const code = barcode.trim();
    if (!/^\d{8,14}$/.test(code)) {
      message.error("请输入 8-14 位数字条码");
      return;
    }
    // 手动输入同样遵循 3 秒防重规则
    const now = Date.now();
    if (
      code === lastBarcodeRef.current &&
      now - lastScanTimeRef.current < DEDUP_WINDOW_MS
    ) {
      message.warning("该条码刚查询过，请稍后再试");
      return;
    }
    lastBarcodeRef.current = code;
    lastScanTimeRef.current = now;
    setLastQueryManual(true);
    productQuery.mutate(code);
  };

  const pickProduct = (p: Product) => {
    setProduct(p);
    setQueryState("success");
  };

  useEffect(() => {
    return () => {
      if (scanRetryTimer.current) clearTimeout(scanRetryTimer.current);
    };
  }, []);

  const canSubmit = !!product && !!userId && !createMutation.isPending;

  /** 扫码框内的查询状态覆盖层（仅扫码模式） */
  const scanOverlay = useMemo(() => {
    if (queryState === "loading") {
      return <span>正在查询商品...</span>;
    }
    if (queryState === "not-found") {
      return (
        <span className="scan-status-error">
          <CloseCircleFilled /> 未找到商品，请重新扫描
        </span>
      );
    }
    if (queryState === "network-error") {
      return <span className="scan-status-error">网络异常，请检查网络</span>;
    }
    if (queryState === "success") {
      return (
        <span className="scan-status-success">
          <CheckCircleFilled /> 识别成功
        </span>
      );
    }
    return undefined;
  }, [queryState]);

  const manualQueryFeedback =
    lastQueryManual && queryState === "not-found" ? (
      <Alert
        type="warning"
        showIcon
        style={{ marginTop: 8 }}
        message="未找到该商品，请检查条码"
      />
    ) : lastQueryManual && queryState === "network-error" ? (
      <Alert
        type="error"
        showIcon
        style={{ marginTop: 8 }}
        message="网络连接失败，请检查网络后重试"
      />
    ) : null;

  const CATEGORY_LABEL: Record<string, string> = {
    BAIJIU: "白酒",
    BEER: "啤酒",
    RED_WINE: "红酒",
    WHITE_WINE: "白葡萄酒",
    SPIRITS: "烈酒",
    COCKTAIL: "鸡尾酒",
    OTHER: "其他",
  };

  return (
    <div className="drink-record-page">
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/rooms/${id}`)}
        style={{ marginBottom: 12, padding: 0 }}
      >
        返回
      </Button>

      <Typography.Title level={4} style={{ marginTop: 0 }}>
        登记饮酒
      </Typography.Title>

      {/* 两种添加方式入口 */}
      {!product && (
        <Segmented
          block
          value={mode}
          onChange={(v) => setMode(v as AddMode)}
          options={[
            { label: "扫码添加", value: "scan" },
            { label: "选择已有酒品", value: "select" },
          ]}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* 方式一：扫码添加 */}
      {mode === "scan" && !product && (
        <>
          <BarcodeScanner
            ref={scannerRef}
            onScanSuccess={handleScanSuccess}
            overlay={scanOverlay}
          />

          <Form
            layout="vertical"
            onFinish={handleBarcodeSubmit}
            style={{ marginTop: 12 }}
          >
            <Form.Item label="条码" style={{ marginBottom: 8 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="手动输入条码"
                  inputMode="numeric"
                  maxLength={14}
                />
                <Button
                  type="default"
                  htmlType="submit"
                  loading={productQuery.isPending}
                >
                  查询
                </Button>
              </Space.Compact>
            </Form.Item>
          </Form>
          {manualQueryFeedback}
        </>
      )}

      {/* 方式二：选择已有酒品 */}
      {mode === "select" && !product && (
        <div className="product-picker">
          <Input
            prefix={<SearchOutlined style={{ color: "var(--muted)" }} />}
            placeholder="搜索名称 / 品牌 / 条码"
            value={selectKeyword}
            onChange={(e) => setSelectKeyword(e.target.value)}
            allowClear
            maxLength={30}
            style={{ marginBottom: 12 }}
          />

          {debouncedKeyword === "" && (
            <div className="picker-hint">
              <Typography.Text type="secondary">
                输入商品名称、品牌或条码，从已录入酒品中选择
              </Typography.Text>
            </div>
          )}

          {debouncedKeyword !== "" && selectQuery.isLoading && (
            <div style={{ textAlign: "center", padding: 24 }}>
              <Spin tip="搜索中..." />
            </div>
          )}

          {debouncedKeyword !== "" && selectQuery.isError && (
            <Alert type="error" showIcon message="网络异常，请重试" />
          )}

          {debouncedKeyword !== "" &&
            selectQuery.isSuccess &&
            selectQuery.data.items.length === 0 && (
              <Alert type="warning" showIcon message="未找到匹配的酒品" />
            )}

          {debouncedKeyword !== "" &&
            selectQuery.isSuccess &&
            selectQuery.data.items.length > 0 && (
              <div className="product-picker-list">
                {selectQuery.data.items.map((p) => (
                  <Card
                    key={p.id}
                    size="small"
                    className="product-picker-card"
                    styles={{ body: { padding: "14px 16px" } }}
                  >
                    <div className="picker-card-body">
                      <div className="picker-card-info">
                        <div className="picker-card-name">{p.name}</div>
                        <div className="picker-card-meta">
                          品牌：{p.brand || "-"} · {p.volumeMl}ml
                          {p.alcoholPercent !== null
                            ? ` · ${p.alcoholPercent}%`
                            : ""}
                          <span className="picker-card-cat">
                            {CATEGORY_LABEL[p.category] || p.category}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => pickProduct(p)}
                      >
                        选择
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}

      {/* 已确认商品：登记数量并提交（扫码 / 选择共用） */}
      {product && (
        <Card
          className="product-confirm product-confirm-anim"
          title="确认酒品"
          style={{ marginBottom: 12 }}
        >
          <Descriptions column={1} size="small" labelStyle={{ width: 80 }}>
            <Descriptions.Item label="名称">{product.name}</Descriptions.Item>
            <Descriptions.Item label="品牌">
              {product.brand || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="容量">
              {product.volumeMl} ml
            </Descriptions.Item>
            <Descriptions.Item label="酒精度">
              {product.alcoholPercent !== null
                ? `${product.alcoholPercent}%`
                : "-"}
            </Descriptions.Item>
          </Descriptions>

          <Form layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item
              label="数量（支持小数，如 0.5）"
              style={{ marginBottom: 12 }}
            >
              <InputNumber
                min={0.01}
                max={100}
                step={0.5}
                precision={2}
                value={quantity}
                onChange={(v) => setQuantity(v ?? 1)}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Space style={{ width: "100%" }}>
              <Button
                type="primary"
                block
                disabled={!canSubmit}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                确认登记
              </Button>
              <Button
                onClick={() => {
                  setProduct(null);
                  setQueryState("idle");
                }}
              >
                重新选择
              </Button>
            </Space>
          </Form>
        </Card>
      )}

      {createMutation.isSuccess && (
        <Result
          status="success"
          title="登记成功"
          extra={[
            <Button
              type="primary"
              key="back"
              onClick={() => navigate(`/rooms/${id}`)}
            >
              查看酒局统计
            </Button>,
            <Button
              key="again"
              onClick={() => {
                setProduct(null);
                setQueryState("idle");
                createMutation.reset();
              }}
            >
              继续登记
            </Button>,
          ]}
        />
      )}
    </div>
  );
}
