import { useState } from "react";
import { Button, Card, Form, Input, message, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { roomsApi } from "../services/rooms";

export default function JoinRoom() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { inviteCode: string }) => {
    setLoading(true);
    try {
      const result = await roomsApi.join(
        values.inviteCode.trim().toUpperCase(),
      );
      message.success("加入成功");
      navigate(`/rooms/${result.room.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/")}
        style={{ marginBottom: 12, padding: 0 }}
      >
        返回
      </Button>
      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          加入酒局
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="inviteCode"
            label="邀请码"
            rules={[
              { required: true, message: "请输入邀请码" },
              {
                pattern: /^[A-Za-z0-9]{6}$/,
                message: "邀请码为 6 位字母或数字",
              },
            ]}
          >
            <Input
              placeholder="请输入 6 位邀请码"
              maxLength={6}
              style={{
                textTransform: "uppercase",
                textAlign: "center",
                letterSpacing: 6,
                fontSize: 18,
              }}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            加入
          </Button>
        </Form>
        <Typography.Paragraph
          type="secondary"
          style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}
        >
          向房主索要邀请码即可加入酒局。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
