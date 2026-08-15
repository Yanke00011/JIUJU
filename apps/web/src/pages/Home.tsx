import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, List, Space, Tag, Typography } from "antd";
import {
  PlusOutlined,
  UnorderedListOutlined,
  CoffeeOutlined,
  TeamOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { roomsApi } from "../services/rooms";
import { useAuthStore } from "../store/auth";
import type { Room } from "../types/api";

const STATUS_LABEL: Record<Room["status"], { text: string; color: string }> = {
  ACTIVE: { text: "进行中", color: "green" },
  ENDED: { text: "已结束", color: "default" },
};

/** 未登录时展示的产品首页 */
function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <div
        style={{
          background: "linear-gradient(160deg, #1677ff 0%, #0958d9 100%)",
          color: "#fff",
          padding: "64px 24px 48px",
          textAlign: "center",
        }}
      >
        <CoffeeOutlined style={{ fontSize: 64, marginBottom: 16 }} />
        <Typography.Title
          level={2}
          style={{ color: "#fff", margin: "0 0 8px" }}
        >
          酒局管家
        </Typography.Title>
        <Typography.Paragraph
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 16,
            marginBottom: 8,
          }}
        >
          扫码记录饮酒 · 朋友聚会防逃酒
        </Typography.Paragraph>
        <Typography.Paragraph
          style={{ color: "rgba(255,255,255,0.65)", marginBottom: 0 }}
        >
          创建酒局，邀请好友，扫码登记，自动统计
        </Typography.Paragraph>
      </div>

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 16px" }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Button
            type="primary"
            size="large"
            block
            onClick={() => navigate("/login")}
          >
            登录
          </Button>
          <Button size="large" block onClick={() => navigate("/register")}>
            注册
          </Button>
        </Space>

        <div style={{ marginTop: 32 }}>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space>
              <SafetyOutlined style={{ color: "#1677ff", fontSize: 20 }} />
              <div>
                <div style={{ fontWeight: 500 }}>防逃酒</div>
                <div style={{ fontSize: 13, color: "#999" }}>
                  谁的酒，喝了多少，一目了然
                </div>
              </div>
            </Space>
          </Card>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space>
              <TeamOutlined style={{ color: "#1677ff", fontSize: 20 }} />
              <div>
                <div style={{ fontWeight: 500 }}>朋友聚会</div>
                <div style={{ fontSize: 13, color: "#999" }}>
                  邀请码加入，成员排行清晰
                </div>
              </div>
            </Space>
          </Card>
          <Card size="small">
            <Space>
              <UnorderedListOutlined
                style={{ color: "#1677ff", fontSize: 20 }}
              />
              <div>
                <div style={{ fontWeight: 500 }}>自动统计</div>
                <div style={{ fontSize: 13, color: "#999" }}>
                  瓶数、容量、酒精量实时排行
                </div>
              </div>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** 已登录时展示的酒局列表 */
function MyRooms() {
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: roomsApi.list,
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          我的酒局
        </Typography.Title>
        <Space>
          <Button
            icon={<PlusOutlined />}
            onClick={() => navigate("/rooms/create")}
          >
            创建酒局
          </Button>
          <Button onClick={() => navigate("/rooms/join")}>加入酒局</Button>
        </Space>
      </div>

      <List
        loading={isLoading}
        locale={{
          emptyText: (
            <Empty
              description="还没有酒局，创建一个吧"
              style={{ padding: "32px 0" }}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/rooms/create")}
              >
                创建酒局
              </Button>
            </Empty>
          ),
        }}
        dataSource={rooms ?? []}
        renderItem={(room) => {
          const status = STATUS_LABEL[room.status];
          return (
            <Card
              hoverable
              size="small"
              style={{ marginBottom: 12 }}
              onClick={() => navigate(`/rooms/${room.id}`)}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>
                    {room.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>
                    <UnorderedListOutlined style={{ marginRight: 4 }} />
                    邀请码：{room.inviteCode}
                  </div>
                </div>
                <Tag color={status.color}>{status.text}</Tag>
              </div>
            </Card>
          );
        }}
      />
    </div>
  );
}

/**
 * 首页：未登录展示产品介绍，已登录展示我的酒局。
 */
export default function Home() {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Landing />;
  }
  return (
    <AppLayout>
      <MyRooms />
    </AppLayout>
  );
}
