import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Card, Empty, Skeleton, Space, Tag, Typography } from "antd";
import { CameraOutlined, CrownOutlined, PlusOutlined, SafetyCertificateOutlined, TeamOutlined, TrophyOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { roomsApi } from "../services/rooms";
import { useAuthStore } from "../store/auth";
import type { Room } from "../types/api";

const STATUS_LABEL: Record<Room["status"], { text: string; color: string }> = { ACTIVE: { text: "进行中", color: "success" }, ENDED: { text: "已结束", color: "default" } };

function Landing() {
  const navigate = useNavigate();
  const features = [[CameraOutlined, "扫码识别", "对准酒瓶条码，酒品信息即刻确认"], [TrophyOutlined, "实时排行", "每一杯都有记录，战况随时更新"], [CrownOutlined, "酒量统计", "瓶数、容量与酒精量一眼看清"], [SafetyCertificateOutlined, "公平记账", "聚会不靠记忆，数据说了算"]] as const;
  const steps = [["01", "创建酒局", "起个名字，马上开场"], ["02", "邀请朋友", "发出六位邀请码"], ["03", "扫码喝酒", "每一瓶都有归属"], ["04", "查看排行", "举杯也要明明白白"]];
  return <main className="landing"><section className="landing-hero"><nav className="landing-nav"><div className="brand-lockup"><span className="brand-mark">酒</span><span><strong>酒局管家</strong><small>JIUJU SOCIAL CLUB</small></span></div><Button type="text" style={{ color: "#fff" }} onClick={() => navigate("/login")}>登录</Button></nav><div className="landing-copy"><span className="eyebrow">聚会的公平记录官</span><h1>酒局管家</h1><p>扫码记录每一杯酒<br />让聚会更公平</p><div className="landing-actions"><Button type="primary" size="large" onClick={() => navigate("/register")}>创建酒局</Button><Button size="large" onClick={() => navigate("/login")}>加入酒局</Button></div></div></section><section className="landing-body"><span className="section-label">ONE TAP, ALL FAIR</span><h2 className="section-title">聚会该尽兴，记录交给我们</h2><div className="feature-grid">{features.map(([Icon, title, desc]) => <article className="feature-card" key={title}><span className="feature-icon"><Icon /></span><h3>{title}</h3><p>{desc}</p></article>)}</div><div className="steps">{steps.map(([no, title, desc]) => <article className="step" key={no}><span className="step-no">{no}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></section></main>;
}

function MyRooms() {
  const navigate = useNavigate();
  const { data: rooms, isLoading, isError } = useQuery({ queryKey: ["rooms"], queryFn: roomsApi.list });
  return <div><div className="page-heading"><div><Typography.Title level={2} className="page-title">我的酒局</Typography.Title><Typography.Paragraph className="page-subtitle">把每一次碰杯，都记得清清楚楚。</Typography.Paragraph></div><Space><Button icon={<TeamOutlined />} onClick={() => navigate("/rooms/join")}>加入</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/rooms/create")}>创建</Button></Space></div>{isLoading ? <Space direction="vertical" size={14} style={{ width: "100%" }}><Card><Skeleton active /></Card><Card><Skeleton active /></Card></Space> : isError ? <Card><Empty description="酒局加载失败，请稍后重试" /></Card> : !rooms?.length ? <Card><Empty description="还没有酒局，先开一桌吧"><Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/rooms/create")}>创建酒局</Button></Empty></Card> : <Space direction="vertical" size={14} style={{ width: "100%" }}>{rooms.map((room) => { const status = STATUS_LABEL[room.status]; return <Card className="room-card" key={room.id} onClick={() => navigate(`/rooms/${room.id}`)}><div className="room-card-top"><div><div className="room-card-name">{room.name}</div><div className="room-code">邀请码 <b>{room.inviteCode}</b></div></div><Tag color={status.color}>{status.text}</Tag></div><div className="room-avatar-group"><Avatar.Group max={{ count: 4 }}><Avatar icon={<UserOutlined />} style={{ backgroundColor: "#8B1E3F" }} /><Avatar icon={<UserOutlined />} style={{ backgroundColor: "#d18a9e" }} /><Avatar icon={<UserOutlined />} style={{ backgroundColor: "#e6a23c" }} /></Avatar.Group><span className="room-members">点击查看酒局详情</span></div></Card>; })}</Space>}</div>;
}

export default function Home() { const token = useAuthStore((state) => state.token); return token ? <AppLayout><MyRooms /></AppLayout> : <Landing />; }
