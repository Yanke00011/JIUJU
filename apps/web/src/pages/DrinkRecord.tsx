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
  CameraOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { productsApi } from "../services/products";
import { drinksApi } from "../services/drinks";
import { useAuthStore } from "../store/auth";
import type { Product } from "../types/api";

const SCANNER_ID = "drink-scanner";

/**
 * 扫码生命周期状态
 * - idle：摄像头已关闭，等待用户打开
 * - starting：正在启动摄像头
 * - scanning：扫描中
 * - querying：已识别条码，正在查询商品
 * - success：识别成功
 * - not-found：商品不存在
 * - network-error：网络异常
 * - camera-denied：摄像头不可用 / 权限不足 / 浏览器不支持
 */
type ScanStatus =
  | "idle"
  | "starting"
  | "scanning"
  | "querying"
  | "success"
  | "not-found"
  | "network-error"
  | "camera-denied";

type QueryState =
  "idle" | "loading" | "success" | "not-found" | "network-error";

/** 同一 barcode 禁止重复查询的时间窗口（毫秒） */
const DEDUP_WINDOW_MS = 3000;

export default function DrinkRecord() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  // ===== 扫码实例与锁：全部用 ref，避免渲染重建 / 回调竞态 =====
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const initializingRef = useRef(false); // 启动中，防止 StrictMode 重复初始化
  const scanLockRef = useRef(false); // 扫码锁：一次识别只触发一次查询
  const lastBarcodeRef = useRef(""); // 最近一次查询的条码
  const lastScanTimeRef = useRef(0); // 最近一次查询时间
  const startScannerRef = useRef<() => void>(() => {});

  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string>("");
  const [product, setProduct] = useState<Product | null>(null);
  const [queryState, setQueryState] = useState<QueryState>("idle");
  const [quantity, setQuantity] = useState<number>(1);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 统一销毁：stop + clear + 释放引用 + 复位锁（幂等，可重复调用）。
   * 在 StrictMode 卸载时也会被调用，确保摄像头/页面退出即释放。
   */
  const destroyScanner = useCallback(() => {
    if (successTimer.current) {
      clearTimeout(successTimer.current);
      successTimer.current = null;
    }
    const scanner = scannerRef.current;
    scannerRef.current = null;
    initializingRef.current = false;
    scanLockRef.current = false;
    if (scanner) {
      try {
        // 注意：stop() 在未启动时可能同步抛错，需 try/catch 包裹
        scanner
          .stop()
          .catch(() => undefined)
          .then(() => {
            try {
              scanner.clear();
            } catch {
              // 实例可能已停止/已被释放，忽略
            }
          });
      } catch {
        // 未启动即被销毁：直接清理 DOM，避免残留 video
        try {
          scanner.clear();
        } catch {
          // 忽略
        }
      }
    }
  }, []);

  const productQuery = useMutation({
    mutationFn: (code: string) => productsApi.findByBarcode(code),
    onMutate: () => {
      setQueryState("loading");
      setProduct(null);
      setScanStatus("querying");
    },
    onSuccess: (p) => {
      setProduct(p);
      setQueryState("success");
      setScanStatus("success");
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setScanStatus("idle"), 900);
    },
    onError: (error) => {
      setProduct(null);
      // 区分 404（商品不存在）与网络/服务器错误
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        setQueryState("not-found");
        setScanStatus("not-found");
      } else {
        setQueryState("network-error");
        setScanStatus("network-error");
      }
      // 稍后复位扫码锁并重新启动摄像头继续扫描
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => {
        setQueryState("idle");
        setScanStatus("idle");
        startScannerRef.current();
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

  /**
   * 扫码成功回调：
   * 加锁 → 停止摄像头（清理 camera）→ 只请求一次商品接口。
   */
  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      const code = decodedText.trim();
      if (!/^\d{8,14}$/.test(code)) return;

      // 扫码锁：识别一次后忽略 html5-qrcode 的后续重复回调
      if (scanLockRef.current) return;

      // 同一 barcode 3 秒内禁止重复查询
      const now = Date.now();
      if (
        code === lastBarcodeRef.current &&
        now - lastScanTimeRef.current < DEDUP_WINDOW_MS
      ) {
        return;
      }

      scanLockRef.current = true;
      lastBarcodeRef.current = code;
      lastScanTimeRef.current = now;
      setBarcode(code);
      setScanStatus("querying");

      // 先停摄像头再查询，避免持续触发回调导致重复请求
      destroyScanner();
      productQuery.mutate(code);
    },
    [destroyScanner, productQuery],
  );

  const startScanner = useCallback(async () => {
    // 单实例：已有实例或正在初始化时禁止重复创建
    if (scannerRef.current || initializingRef.current) return;
    if (scanLockRef.current) return;

    initializingRef.current = true;
    setScanStatus("starting");
    setCameraError(null);
    setQueryState("idle");

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
    // 立即注册实例（先于 start()），保证 StrictMode 的 cleanup 能正确释放
    scannerRef.current = qr;

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

      // 启动期间已被销毁/替换，放弃本次实例
      if (scannerRef.current !== qr) return;

      await qr.start(
        deviceId ? { deviceId } : { facingMode: "environment" },
        { fps: 10 },
        handleScanSuccess,
        () => {
          // 忽略单帧解码失败回调
        },
      );

      if (scannerRef.current !== qr) {
        // start 期间被销毁：立即停止并清理，避免残留 video/stream
        try {
          qr.stop()
            .catch(() => undefined)
            .then(() => {
              try {
                qr.clear();
              } catch {
                // 忽略
              }
            });
        } catch {
          try {
            qr.clear();
          } catch {
            // 忽略
          }
        }
        return;
      }

      initializingRef.current = false;
      setScanStatus("scanning");
    } catch (err) {
      if (scannerRef.current !== qr) return; // 已被替换，不处理
      scannerRef.current = null;
      initializingRef.current = false;
      setCameraError(mapCameraError(err));
      setScanStatus("camera-denied");
      try {
        qr.clear();
      } catch {
        // 忽略
      }
    }
  }, [destroyScanner, handleScanSuccess]);

  // 始终持有最新的 startScanner，供异步错误恢复调用
  useEffect(() => {
    startScannerRef.current = startScanner;
  }, [startScanner]);

  // 进入页面自动启动摄像头；卸载时立即释放摄像头
  useEffect(() => {
    void startScanner();
    return () => {
      destroyScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    productQuery.mutate(code);
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

  const showScanStatus =
    scanStatus === "scanning" ||
    scanStatus === "querying" ||
    scanStatus === "success" ||
    scanStatus === "not-found" ||
    scanStatus === "network-error";

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
          {scanStatus === "starting" && (
            <div className="scanner-placeholder">
              <Spin size="large" />
              <Typography.Text style={{ color: "#fff", marginTop: 8 }}>
                正在启动摄像头...
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

          {/* 扫码状态提示（与 scanning 解耦，摄像头停止后仍可显示） */}
          {showScanStatus && (
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
                  网络异常，请检查网络
                </span>
              )}
              {scanStatus === "querying" && (
                <span>正在查询商品...</span>
              )}
              {scanStatus === "scanning" && (
                <span>正在扫描酒瓶条码...</span>
              )}
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
                onClick={() => void startScanner()}
              >
                重试
              </Button>
            </Space>
          </div>
        )}

        {scanStatus === "scanning" && (
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => {
              destroyScanner();
              setScanStatus("idle");
              setQueryState("idle");
            }}
            size="small"
            style={{ display: "block", margin: "0 auto 12px" }}
          >
            关闭摄像头
          </Button>
        )}

        {scanStatus === "idle" && !product && (
          <Button
            block
            type="primary"
            icon={<CameraOutlined />}
            onClick={() => void startScanner()}
            style={{ marginTop: 12 }}
          >
            打开摄像头扫码
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

        {queryState === "loading" && scanStatus !== "querying" && (
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
    return "摄像头权限不足，请在浏览器设置中允许摄像头权限";
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
