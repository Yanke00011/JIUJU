import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Space,
  Spin,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { productsApi } from "../services/products";
import { drinksApi } from "../services/drinks";
import { useAuthStore } from "../store/auth";
import type { Product } from "../types/api";

const SCANNER_ID = "drink-scanner";

type ScanStatus =
  | "idle"
  | "starting"
  | "scanning"
  | "success"
  | "not-found"
  | "camera-denied"
  | "network-error";

type QueryState =
  "idle" | "loading" | "success" | "not-found" | "network-error";

export default function DrinkRecord() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string>("");
  const [product, setProduct] = useState<Product | null>(null);
  const [queryState, setQueryState] = useState<QueryState>("idle");
  const [quantity, setQuantity] = useState<number>(1);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productQuery = useMutation({
    mutationFn: (code: string) => productsApi.findByBarcode(code),
    onMutate: () => {
      setQueryState("loading");
      setProduct(null);
    },
    onSuccess: (p) => {
      setProduct(p);
      setQueryState("success");
      setScanStatus("success");
      stopScanner();
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setScanStatus("idle"), 900);
    },
    onError: (error) => {
      setProduct(null);
      setQueryState("network-error");
      // 区分 404（未找到）与网络/服务器错误
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        setQueryState("not-found");
        setScanStatus("not-found");
      } else {
        setQueryState("network-error");
        setScanStatus("network-error");
      }
      // 稍后恢复扫描状态
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => {
        setScanStatus((prev) =>
          prev === "not-found" || prev === "network-error" ? "scanning" : prev,
        );
        setQueryState((prev) =>
          prev === "not-found" || prev === "network-error" ? "idle" : prev,
        );
      }, 1800);
    },
  });

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
      setScanStatus("idle");
    },
  });

  /** 停止并释放摄像头（幂等） */
  const stopScanner = useCallback(async () => {
    if (successTimer.current) clearTimeout(successTimer.current);
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // 忽略停止异常
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current || scanning) return; // 避免重复初始化
    setScanStatus("starting");
    setCameraError(null);

    const qr = new Html5Qrcode(SCANNER_ID, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    });

    try {
      // 优先选择后置摄像头，回退到 facingMode
      let deviceId: string | undefined;
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras.length > 0) {
          const back = cameras.find((c) =>
            /back|rear|environment/i.test(c.label),
          );
          deviceId = (back ?? cameras[0]).id;
        }
      } catch {
        deviceId = undefined;
      }

      await qr.start(
        deviceId ? { deviceId } : { facingMode: "environment" },
        { fps: 10 },
        (decodedText) => {
          const code = decodedText.trim();
          if (!/^\d{8,14}$/.test(code)) return;
          setBarcode(code);
          productQuery.mutate(code);
        },
        () => {
          // 忽略单帧解码失败回调
        },
      );

      scannerRef.current = qr;
      setScanning(true);
      setScanStatus("scanning");
    } catch (err) {
      setScanning(false);
      setCameraError(mapCameraError(err));
      setScanStatus("camera-denied");
      try {
        await qr.clear();
      } catch {
        // 忽略
      }
      scannerRef.current = null;
    }
  }, [productQuery, scanning]);

  useEffect(() => {
    // 进入页面自动请求后置摄像头
    startScanner();
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBarcodeSubmit = () => {
    if (!/^\d{8,14}$/.test(barcode.trim())) {
      message.error("请输入 8-14 位数字条码");
      return;
    }
    productQuery.mutate(barcode.trim());
  };

  const canSubmit = !!product && !!userId && !createMutation.isPending;

  const manualQueryFeedback =
    queryState === "not-found" ? (
      <Alert
        type="warning"
        showIcon
        style={{ marginTop: 8 }}
        message="未找到该商品，请检查条码"
      />
    ) : queryState === "network-error" ? (
      <Alert
        type="error"
        showIcon
        style={{ marginTop: 8 }}
        message="网络连接失败，请检查网络后重试"
      />
    ) : null;

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

      {/* 全屏扫码区域 */}
      <div className="scanner-shell">
        <div className="scanner-frame">
          {/* 摄像头初始化前展示加载状态 */}
          {!scanning && scanStatus !== "camera-denied" && (
            <div className="scanner-placeholder">
              <Spin size="large" />
              <Typography.Text style={{ color: "#fff", marginTop: 8 }}>
                {scanStatus === "starting"
                  ? "正在启动摄像头..."
                  : "正在准备摄像头..."}
              </Typography.Text>
            </div>
          )}
          <div id={SCANNER_ID} style={{ width: "100%" }} />
          {/* 半透明遮罩 + 四角装饰 + 扫描线 由 CSS 实现 */}
          <div className="scanner-overlay">
            <div className="scan-corner corner-tl" />
            <div className="scan-corner corner-tr" />
            <div className="scan-corner corner-bl" />
            <div className="scan-corner corner-br" />
            <div className="scan-line" />
          </div>

          {/* 扫码状态提示 */}
          {scanning && (
            <div className="scan-status">
              {scanStatus === "success" && (
                <span className="scan-status-success">
                  <CheckCircleFilled /> 识别成功
                </span>
              )}
              {scanStatus === "not-found" && (
                <span className="scan-status-error">
                  <CloseCircleFilled /> 未找到商品，请重新扫描
                </span>
              )}
              {scanStatus === "network-error" && (
                <span className="scan-status-error">
                  网络连接失败，请检查网络
                </span>
              )}
              {scanStatus === "scanning" && <span>正在扫描酒瓶条码...</span>}
            </div>
          )}
        </div>

        {scanStatus === "camera-denied" && (
          <div className="camera-denied">
            <Typography.Text strong>无法打开摄像头</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {cameraError}
            </Typography.Paragraph>
            <Space>
              <Button size="small" onClick={() => setScanStatus("idle")}>
                知道了
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={() => startScanner()}
              >
                重试
              </Button>
            </Space>
          </div>
        )}

        {scanning && (
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => stopScanner()}
            size="small"
            style={{ display: "block", margin: "0 auto 12px" }}
          >
            关闭摄像头
          </Button>
        )}

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

        {queryState === "loading" && (
          <div style={{ textAlign: "center", padding: 16 }}>
            <Spin tip="查询商品中..." />
          </div>
        )}
        {manualQueryFeedback}
      </div>

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
                  setScanStatus("idle");
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

/** 将 html5-qrcode 异常映射为友好中文提示 */
function mapCameraError(err: unknown): string {
  const messageText = err instanceof Error ? err.message : String(err);
  const lower = messageText.toLowerCase();
  if (
    lower.includes("not allowed") ||
    lower.includes("permission") ||
    lower.includes("denied")
  ) {
    return "摄像头权限被拒绝，请在浏览器设置中允许摄像头权限";
  }
  if (lower.includes("not secure") || lower.includes("https")) {
    return "摄像头需要 HTTPS 或 localhost 环境，请通过 HTTPS 访问";
  }
  if (
    lower.includes("not supported") ||
    lower.includes("not found") ||
    lower.includes("getusermedia")
  ) {
    return "当前浏览器不支持摄像头，请使用 Chrome / Safari / 微信内置浏览器";
  }
  if (lower.includes("device") || lower.includes("no camera")) {
    return "未检测到可用摄像头，请检查设备";
  }
  return "摄像头不可用，请检查设备与权限";
}
