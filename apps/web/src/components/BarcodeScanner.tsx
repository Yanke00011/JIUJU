import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, Space, Spin, Typography } from "antd";
import { CameraOutlined, ReloadOutlined } from "@ant-design/icons";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

export interface BarcodeScannerHandle {
  start: () => void;
  stop: () => void;
}

interface BarcodeScannerProps {
  /** 一次有效解码回调（已加锁 + 3 秒防重，摄像头会先停止再回调） */
  onScanSuccess: (code: string) => void;
  /** 挂载后是否自动启动摄像头（默认 true） */
  autoStart?: boolean;
  /** 在扫码框内额外渲染的状态（如「查询商品中 / 识别成功」） */
  overlay?: ReactNode;
  /** 摄像头异常 → 中文提示（默认内置映射） */
  mapError?: (err: unknown) => string;
}

/** 摄像头生命周期状态（查询类状态由父组件通过 overlay 展示） */
type ScannerState = "idle" | "starting" | "scanning" | "camera-denied";

/** 同一 barcode 禁止重复查询的时间窗口（毫秒） */
const DEDUP_WINDOW_MS = 3000;

/** 全局唯一容器 id，避免多个实例（如弹窗）共存时冲突 */
let scannerSeq = 0;

/** 停止并清理一个已创建的 Html5Qrcode 实例（兼容未启动时同步抛错） */
function stopAndClear(scanner: Html5Qrcode): void {
  try {
    scanner
      .stop()
      .catch(() => undefined)
      .then(() => {
        try {
          scanner.clear();
        } catch {
          // 忽略
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

function defaultMapError(err: unknown): string {
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

export const BarcodeScanner = forwardRef<BarcodeScannerHandle, BarcodeScannerProps>(
  function BarcodeScanner(
    { onScanSuccess, autoStart = true, overlay, mapError = defaultMapError },
    ref,
  ) {
    const scannerIdRef = useRef(`barcode-scanner-${++scannerSeq}`);

    // ===== 实例与锁：全部用 ref，避免渲染重建 / 回调竞态 =====
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const initializingRef = useRef(false); // 启动中，防止 StrictMode 重复初始化
    const scanLockRef = useRef(false); // 扫码锁：一次识别只触发一次回调
    const lastBarcodeRef = useRef(""); // 最近一次条码
    const lastScanTimeRef = useRef(0); // 最近一次扫码时间
    const onScanSuccessRef = useRef(onScanSuccess);
    onScanSuccessRef.current = onScanSuccess;

    const [state, setState] = useState<ScannerState>("idle");
    const [cameraError, setCameraError] = useState<string | null>(null);

    /**
     * 统一销毁：stop + clear + 释放引用 + 复位锁（幂等，可重复调用）。
     * 在 StrictMode 卸载时也会被调用，确保摄像头/退出即释放。
     */
    const destroyScanner = useCallback(() => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      initializingRef.current = false;
      scanLockRef.current = false;
      if (scanner) {
        stopAndClear(scanner);
      }
    }, []);

    const stop = useCallback(() => {
      destroyScanner();
      setState("idle");
      setCameraError(null);
    }, [destroyScanner]);

    /** 扫码成功回调：加锁 → 停摄像头（清理 camera）→ 只回调一次 */
    const handleScan = useCallback(
      (decodedText: string) => {
        const code = decodedText.trim();
        if (!/^\d{8,14}$/.test(code)) return;

        // 扫码锁：识别一次后忽略 html5-qrcode 的后续重复回调
        if (scanLockRef.current) return;

        // 同一 barcode 3 秒内禁止重复回调
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

        // 先停摄像头再回调，避免持续触发
        stop();
        onScanSuccessRef.current(code);
      },
      [stop],
    );

    const start = useCallback(() => {
      void (async () => {
        // 单实例：已有实例或正在初始化时禁止重复创建
        if (scannerRef.current || initializingRef.current) return;
        if (scanLockRef.current) return;

        initializingRef.current = true;
        setState("starting");
        setCameraError(null);

        const qr = new Html5Qrcode(scannerIdRef.current, {
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
          // 优先后置摄像头，回退 facingMode
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
            handleScan,
            () => {
              // 忽略单帧解码失败回调
            },
          );

          if (scannerRef.current !== qr) {
            // start 期间被销毁：立即停止并清理，避免残留 video/stream
            stopAndClear(qr);
            return;
          }

          initializingRef.current = false;
          setState("scanning");
        } catch (err) {
          if (scannerRef.current !== qr) return; // 已被替换，不处理
          scannerRef.current = null;
          initializingRef.current = false;
          setCameraError(mapError(err));
          setState("camera-denied");
          try {
            qr.clear();
          } catch {
            // 忽略
          }
        }
      })();
    }, [handleScan, mapError]);

    // 挂载时自动启动；卸载时立即释放摄像头
    useEffect(() => {
      if (autoStart) {
        start();
      }
      return () => {
        destroyScanner();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({ start, stop }), [start, stop]);

    const showStatus = state === "scanning" || !!overlay;

    return (
      <div className="scanner-shell">
        <div className="scanner-frame">
          {state === "starting" && (
            <div className="scanner-placeholder">
              <Spin size="large" />
              <Typography.Text style={{ color: "#fff", marginTop: 8 }}>
                正在启动摄像头...
              </Typography.Text>
            </div>
          )}
          <div id={scannerIdRef.current} style={{ width: "100%" }} />
          {/* 半透明遮罩 + 四角装饰 + 扫描线 由 CSS 实现 */}
          <div className="scanner-overlay">
            <div className="scan-corner corner-tl" />
            <div className="scan-corner corner-tr" />
            <div className="scan-corner corner-bl" />
            <div className="scan-corner corner-br" />
            <div className="scan-line" />
          </div>

          {showStatus && (
            <div className="scan-status">
              {overlay}
              {state === "scanning" && (
                <span>正在扫描酒瓶条码...</span>
              )}
            </div>
          )}
        </div>

        {state === "camera-denied" && (
          <div className="camera-denied">
            <Typography.Text strong>无法打开摄像头</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {cameraError}
            </Typography.Paragraph>
            <Space>
              <Button size="small" onClick={() => setState("idle")}>
                知道了
              </Button>
              <Button size="small" type="primary" onClick={start}>
                重试
              </Button>
            </Space>
          </div>
        )}

        {state === "scanning" && (
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={stop}
            size="small"
            style={{ display: "block", margin: "0 auto 12px" }}
          >
            关闭摄像头
          </Button>
        )}

        {state === "idle" && (
          <Button
            block
            type="primary"
            icon={<CameraOutlined />}
            onClick={start}
            style={{ marginTop: 12 }}
          >
            打开摄像头扫码
          </Button>
        )}
      </div>
    );
  },
);
