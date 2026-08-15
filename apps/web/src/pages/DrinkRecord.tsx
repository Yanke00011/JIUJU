import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Descriptions,
  Form,
  InputNumber,
  message,
  Result,
  Space,
  Spin,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  CameraOutlined,
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
  "idle" | "scanning" | "success" | "not-found" | "camera-denied";

export default function DrinkRecord() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [barcode, setBarcode] = useState<string>("");
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const productQuery = useMutation({
    mutationFn: (code: string) => productsApi.findByBarcode(code),
    onSuccess: (p) => {
      setProduct(p);
      setScanStatus("success");
      stopScanner();
      // 短暂展示识别成功动画后展示商品
      setTimeout(() => setScanStatus("idle"), 900);
    },
    onError: () => {
      setProduct(null);
      setScanStatus("not-found");
      // 未找到商品，提示后继续扫描
      setTimeout(() => setScanStatus("scanning"), 1800);
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
      setScanStatus("idle");
    },
  });

  useEffect(() => {
    return () => {
      // 组件卸载时释放摄像头
      scanner?.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScanner = useCallback(() => {
    setScanStatus("scanning");
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
    qr.start(
      { facingMode: "environment" },
      { fps: 10 },
      (decodedText) => {
        const code = decodedText.trim();
        setBarcode(code);
        productQuery.mutate(code);
      },
      () => {
        // 忽略解码失败回调
      },
    )
      .then(() => {
        setScanner(qr);
        setScanning(true);
      })
      .catch(() => {
        setScanning(false);
        setScanStatus("camera-denied");
      });
  }, [productQuery]);

  const stopScanner = useCallback(() => {
    if (scanner) {
      scanner.stop().catch(() => undefined);
      scanner.clear();
      setScanner(null);
      setScanning(false);
      setScanStatus("idle");
    }
  }, [scanner]);

  const handleBarcodeSubmit = () => {
    if (!/^\d{8,14}$/.test(barcode.trim())) {
      message.error("请输入 8-14 位数字条码");
      return;
    }
    productQuery.mutate(barcode.trim());
  };

  const canSubmit = !!product && !!userId && !createMutation.isPending;

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
        <div
          className="scanner-frame"
          style={{ display: scanning ? "block" : "none" }}
        >
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
            {scanStatus === "scanning" && <span>正在扫描酒瓶条码...</span>}
          </div>
        </div>

        {scanStatus === "camera-denied" && (
          <div className="camera-denied">
            <Typography.Text strong>无法打开摄像头</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              请允许摄像头权限，或在 HTTPS / localhost
              下访问；也可以手动输入条码。
            </Typography.Paragraph>
            <Button size="small" onClick={() => setScanStatus("idle")}>
              知道了
            </Button>
          </div>
        )}

        {!scanning && scanStatus !== "camera-denied" && (
          <Button
            icon={<CameraOutlined />}
            block
            onClick={startScanner}
            style={{ marginBottom: 12 }}
          >
            打开摄像头扫码
          </Button>
        )}
        {scanning && (
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={stopScanner}
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
              <InputNumber
                value={barcode}
                onChange={(v) => setBarcode(v ?? "")}
                placeholder="手动输入条码"
                style={{ width: "100%" }}
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
      </div>

      {productQuery.isPending && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin tip="查询商品中..." />
        </div>
      )}

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
