import { useState } from "react";
import { Button, Card, Form, Input, message, Tabs, Typography } from "antd";
import { UserOutlined, LockOutlined, MobileOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../services/auth";
import { useAuthStore } from "../store/auth";

type Mode = "login" | "register";

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [mode, setMode] = useState<Mode>(
    location.pathname === "/register" ? "register" : "login",
  );
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
        const result = await authApi.login(
          values.username.trim(),
          values.password,
        );
        setAuth(result.accessToken, result.user);
        message.success("登录成功");
        navigate("/", { replace: true });
      } else {
        const nickname = values.nickname?.trim() || values.username.trim();
        await authApi.register(
          values.username.trim(),
          values.password,
          nickname,
        );
        message.success("注册成功，请登录");
        setMode("login");
        form.resetFields();
      }
    } catch {
      // 错误提示由全局 request 拦截器统一处理
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
            扫码记录饮酒 · 朋友聚会防逃酒
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
              rules={[
                { required: true, message: "请输入昵称" },
                { max: 50, message: "昵称最多 50 个字符" },
              ]}
            >
              <Input
                prefix={<MobileOutlined />}
                placeholder="你的昵称"
                maxLength={50}
              />
            </Form.Item>
          )}
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: "请输入用户名" },
              {
                pattern: USERNAME_PATTERN,
                message: "用户名需为 3-32 位字母、数字、下划线或连字符",
              },
            ]}
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
            rules={[
              { required: true, message: "请输入密码" },
              ...(mode === "register"
                ? [
                    {
                      pattern: PASSWORD_PATTERN,
                      message: "密码至少 8 位，且包含字母和数字",
                    },
                  ]
                : []),
            ]}
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

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Button type="link" size="small" onClick={() => navigate("/")}>
            返回首页
          </Button>
        </div>
      </Card>
    </div>
  );
}
