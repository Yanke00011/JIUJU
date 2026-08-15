import { useState } from "react";
import { Button, Card, Form, Input, message, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { roomsApi } from "../services/rooms";

export default function CreateRoom() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { name: string }) => {
    setLoading(true);
    try {
      const room = await roomsApi.create(values.name.trim());
      message.success("酒局创建成功");
      navigate(`/rooms/${room.id}`);
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
        <Typography.Title level={3} className="page-title">创建酒局</Typography.Title>
        <Typography.Paragraph className="page-subtitle">给这次碰杯起个名字，邀请朋友入席。</Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="name"
            label="酒局名称"
            rules={[
              { required: true, whitespace: true, message: "请输入酒局名称" },
            ]}
          >
            <Input placeholder="例如：周末朋友酒局" maxLength={100} showCount />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            创建
          </Button>
        </Form>
        <Typography.Paragraph
          type="secondary"
          style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}
        >
          创建后你会自动成为房主，并生成邀请码供好友加入。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
