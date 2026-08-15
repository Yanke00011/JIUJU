import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
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
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { productsApi } from "../services/products";
import { drinksApi } from "../services/drinks";
import { useAuthStore } from "../store/auth";
import type { Product } from "../types/api";

const SCANNER_ID = "drink-scanner";

export default function DrinkRecord() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string>("");
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const productQuery = useMutation({
    mutationFn: (code: string) => productsApi.findByBarcode(code),
    onSuccess: (p) => {
      setProduct(p);
      stopScanner();
    },
    onError: () => {
      setProduct(null);
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
      .catch((err) => {
        setCameraError(String(err));
        setScanning(false);
      });
  }, [productQuery]);

  const stopScanner = useCallback(() => {
    if (scanner) {
      scanner.stop().catch(() => undefined);
      scanner.clear();
      setScanner(null);
      setScanning(false);
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
    <div>
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

      <Card size="small" style={{ marginBottom: 12 }}>
        <Typography.Paragraph
          type="secondary"
          style={{ marginTop: 0, fontSize: 13 }}
        >
          对准酒瓶条码，自动识别并查询商品；也可手动输入条码。
        </Typography.Paragraph>

        {cameraError && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="无法打开摄像头"
            description="请允许摄像头权限，或在 HTTPS / localhost 下访问；也可以手动输入条码。"
          />
        )}

        <div className="scanner-frame" style={{ display: scanning ? "block" : "none" }}><div id={SCANNER_ID} style={{ width: "100%" }} /></div>

        {!scanning && !product && (
          <Button
            icon={<CameraOutlined />}
            block
            onClick={startScanner}
            style={{ marginBottom: 12 }}
          >
            打开摄像头扫码
          </Button>
        )}
        {scanning && !product && (
          <Space
            style={{ width: "100%", justifyContent: "center", display: "flex" }}
          >
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={stopScanner}
              size="small"
            >
              关闭摄像头
            </Button>
          </Space>
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
      </Card>

      {productQuery.isPending && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin tip="查询商品中..." />
        </div>
      )}

      {product && (
        <Card className="product-confirm" title="确认酒品" style={{ marginBottom: 12 }}>
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
              <Button onClick={() => setProduct(null)}>重新选择</Button>
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
            <Button key="again" onClick={() => setProduct(null)}>
              继续登记
            </Button>,
          ]}
        />
      )}
    </div>
  );
}
