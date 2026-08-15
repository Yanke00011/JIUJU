import { useState } from "react";
import { Button, Card, Form, Input, message, Tabs, Typography } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/auth";
import { useAuthStore } from "../store/auth";

type Mode = "login" | "register";

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: {
    username: string;
    password: string;
    nickname?: string;
  }) => {
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await authApi.login(values.username, values.password);
        setAuth(result.accessToken, result.user);
        message.success("登录成功");
        navigate("/", { replace: true });
      } else {
        const nickname = values.nickname?.trim() || values.username;
        await authApi.register(values.username, values.password, nickname);
        message.success("注册成功，请登录");
        setMode("login");
        form.setFieldsValue({ password: undefined, nickname: undefined });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
        padding: 16,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            酒局管家
          </Typography.Title>
          <Typography.Text type="secondary">
            和朋友一起记录每一杯酒
          </Typography.Text>
        </div>

        <Tabs
          activeKey={mode}
          centered
          onChange={(key) => {
            setMode(key as Mode);
            form.resetFields();
          }}
          items={[
            { key: "login", label: "登录" },
            { key: "register", label: "注册" },
          ]}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
        >
          {mode === "register" && (
            <Form.Item
              name="nickname"
              label="昵称"
              rules={[{ required: true, message: "请输入昵称" }]}
            >
              <Input placeholder="你的昵称" maxLength={50} />
            </Form.Item>
          )}
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              maxLength={32}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              maxLength={128}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {mode === "login" ? "登录" : "注册"}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
