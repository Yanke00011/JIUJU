import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  Skeleton,
  Space,
  Tag,
} from "antd";
import {
  CameraOutlined,
  CrownOutlined,
  GiftOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { roomsApi } from "../services/rooms";
import { useAuthStore } from "../store/auth";
import type { Room } from "../types/api";

const STATUS_LABEL: Record<Room["status"], { text: string; color: string }> = {
  ACTIVE: { text: "进行中", color: "success" },
  ENDED: { text: "已结束", color: "default" },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  BEER: "🍺",
  BAIJIU: "🥃",
  RED_WINE: "🍷",
  WHITE_WINE: "🍷",
  SPIRITS: "🥃",
  COCKTAIL: "🍸",
  OTHER: "🍾",
};

function Landing() {
  const navigate = useNavigate();
  const features = [
    [CameraOutlined, "扫码记录", "对准酒瓶条码，酒品信息即刻确认"],
    [TrophyOutlined, "实时排行", "每一杯都有记录，战况随时更新"],
    [CrownOutlined, "酒量统计", "瓶数、容量与酒精量一眼看清"],
    [SafetyCertificateOutlined, "防止逃酒", "数据实时同步，谁也别想赖账"],
  ] as const;
  const badges = ["朋友聚会", "扫码即记", "实时排行", "防止逃酒"] as const;
  const steps = [
    ["01", "创建酒局", "起个名字，马上开场"],
    ["02", "邀请朋友", "发出六位邀请码"],
    ["03", "扫码喝酒", "每一瓶都有归属"],
    ["04", "查看排行", "举杯也要明明白白"],
  ] as const;
  return (
    <main className="landing">
      <section className="landing-hero">
        <nav className="landing-nav">
          <div className="brand-lockup">
            <span className="brand-mark">酒</span>
            <span>
              <strong>酒局管家</strong>
              <small>JIUJU SOCIAL CLUB</small>
            </span>
          </div>
          <Button
            type="text"
            style={{ color: "#fff" }}
            onClick={() => navigate("/login")}
          >
            登录
          </Button>
        </nav>
        <div className="landing-copy">
          <span className="eyebrow">聚会的公平记录官</span>
          <h1>酒局管家</h1>
          <p>
            朋友聚会，扫码记录每一杯
            <br />
            让每一局都明明白白
          </p>
          <div className="landing-badges">
            {badges.map((b) => (
              <span className="landing-badge" key={b}>
                <GiftOutlined />
                {b}
              </span>
            ))}
          </div>
          <div className="landing-actions">
            <Button type="primary" size="large" onClick={() => navigate("/register")}>
              创建酒局
            </Button>
            <Button size="large" onClick={() => navigate("/login")}>
              加入酒局
            </Button>
          </div>
        </div>
      </section>
      <section className="landing-body">
        <span className="section-label">ONE TAP, ALL FAIR</span>
        <h2 className="section-title">聚会该尽兴，记录交给我们</h2>
        <div className="feature-grid">
          {features.map(([Icon, title, desc]) => (
            <article className="feature-card" key={title}>
              <span className="feature-icon">
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
        <div className="steps">
          {steps.map(([no, title, desc]) => (
            <article className="step" key={no}>
              <span className="step-no">{no}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MyRooms() {
  const navigate = useNavigate();
  const { data: rooms, isLoading, isError } = useQuery({
    queryKey: ["rooms"],
    queryFn: roomsApi.list,
  });
  return (
    <div>
      <PageHeader
        title="我的酒局"
        subtitle="把每一次碰杯，都记得清清楚楚。"
        extra={
          <>
            <Button
              icon={<TeamOutlined />}
              onClick={() => navigate("/rooms/join")}
            >
              加入
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/rooms/create")}
            >
              创建
            </Button>
          </>
        }
      />
      {isLoading ? (
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Card>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
          <Card>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </Space>
      ) : isError ? (
        <Card>
          <EmptyState
            description="酒局加载失败"
            hint="请检查网络后重试"
            action={
              <Button
                type="primary"
                onClick={() => window.location.reload()}
              >
                重新加载
              </Button>
            }
          />
        </Card>
      ) : !rooms?.length ? (
        <Card>
          <EmptyState
            description="还没有酒局，先开一桌吧"
            hint="创建酒局或输入好友的邀请码加入"
            action={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/rooms/create")}
              >
                创建酒局
              </Button>
            }
          />
        </Card>
      ) : (
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          {rooms.map((room) => {
            const status = STATUS_LABEL[room.status];
            const icon =
              CATEGORY_ICONS[room.status === "ACTIVE" ? "BEER" : "OTHER"];
            return (
              <Card
                className="room-card"
                key={room.id}
                onClick={() => navigate(`/rooms/${room.id}`)}
              >
                <div className="room-card-top">
                  <div>
                    <div className="room-card-name">
                      <span style={{ marginRight: 6 }}>{icon}</span>
                      {room.name}
                    </div>
                    <div className="room-code">
                      邀请码 <b>{room.inviteCode}</b>
                    </div>
                  </div>
                  <Tag color={status.color}>{status.text}</Tag>
                </div>
                <div className="room-avatar-group">
                  <Avatar.Group max={{ count: 4 }}>
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#8B1E3F" }} />
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#d18a9e" }} />
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#e6a23c" }} />
                  </Avatar.Group>
                  <span className="room-members">点击查看酒局详情</span>
                </div>
              </Card>
            );
          })}
        </Space>
      )}
    </div>
  );
}

export default function Home() {
  const token = useAuthStore((state) => state.token);
  return token ? (
    <AppLayout>
      <MyRooms />
    </AppLayout>
  ) : (
    <Landing />
  );
}
