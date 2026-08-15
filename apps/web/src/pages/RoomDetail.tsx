import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  Empty,
  List,
  Popconfirm,
  Progress,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  TrophyOutlined,
  UserOutlined,
  EditOutlined,
  CopyOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { roomsApi } from "../services/rooms";
import { statisticsApi } from "../services/statistics";
import { useAuthStore } from "../store/auth";
import type { Room } from "../types/api";

/** 结束冷静期：15 分钟 */
const ROOM_END_COOLING_MS = 15 * 60 * 1000;

const STATUS_LABEL: Record<Room["status"], { text: string; color: string }> = {
  ACTIVE: { text: "进行中", color: "green" },
  ENDING: { text: "即将结束", color: "gold" },
  ENDED: { text: "已结束", color: "default" },
};

function formatRemaining(ms: number): string {
  const safe = Math.max(0, ms);
  const mm = Math.floor(safe / 60000);
  const ss = Math.floor((safe % 60000) / 1000);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function RoomDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  const roomQuery = useQuery({
    queryKey: ["room", id],
    queryFn: () => roomsApi.detail(id),
  });

  const membersQuery = useQuery({
    queryKey: ["room-members", id],
    queryFn: () => roomsApi.members(id),
  });

  const statsQuery = useQuery({
    queryKey: ["room-statistics", id],
    queryFn: () => statisticsApi.getRoomStatistics(id),
    refetchInterval: 15000,
  });

  const room = roomQuery.data;

  // ===== 结束冷静期倒计时：归零后自动归档（重新拉取房间）=====
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (room?.status !== "ENDING" || !room.endedAt) return;
    const target = new Date(room.endedAt).getTime() + ROOM_END_COOLING_MS;
    const tick = () => {
      const rem = target - Date.now();
      if (rem <= 0) {
        setRemaining(0);
        void roomQuery.refetch();
        return;
      }
      setRemaining(rem);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.endedAt]);

  const refreshRoomsList = () => {
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  const endMutation = useMutation({
    mutationFn: () => roomsApi.end(id),
    onSuccess: () => {
      message.success("已进入结束流程，15 分钟内可撤销");
      void roomQuery.refetch();
      refreshRoomsList();
    },
  });

  const cancelEndMutation = useMutation({
    mutationFn: () => roomsApi.cancelEnd(id),
    onSuccess: () => {
      message.success("已撤销结束，酒局恢复进行中");
      void roomQuery.refetch();
      refreshRoomsList();
    },
  });

  const isOwner = room?.ownerId === userId;

  if (roomQuery.isLoading) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (roomQuery.isError || !room) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <Typography.Text>酒局不存在或无法访问</Typography.Text>
        <div>
          <Button style={{ marginTop: 12 }} onClick={() => navigate("/")}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const status = STATUS_LABEL[room.status];
  const members = membersQuery.data ?? [];
  const stats = statsQuery.data;
  const maxUserAlcohol = Math.max(
    0,
    ...(stats?.users.map((u) => u.alcoholMl) ?? [0]),
  );
  const maxProductQty = Math.max(
    0,
    ...(stats?.products.map((p) => p.quantity) ?? [0]),
  );

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      message.success("邀请码已复制");
    } catch {
      message.error("复制失败，请手动记录");
    }
  };

  return (
    <div style={{ paddingBottom: 88 }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/")}
        style={{ marginBottom: 12, padding: 0 }}
      >
        返回
      </Button>

      <Card className="room-hero" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            {room.name}
          </Typography.Title>
          <Tag color={room.status === "ENDED" ? "default" : "gold"}>{status.text}</Tag>
        </div>

        {/* 结束冷静期提示 */}
        {room.status === "ENDING" && (
          <div className="room-ending-banner">
            <ClockCircleOutlined style={{ marginRight: 6 }} />
            <span>
              酒局即将结束 · 剩余 <b>{formatRemaining(remaining)}</b>
              {!isOwner && "（房主可撤销）"}
            </span>
            {isOwner && (
              <Popconfirm
                title="确定撤销结束？酒局将恢复为进行中。"
                onConfirm={() => cancelEndMutation.mutate()}
              >
                <Button
                  size="small"
                  type="primary"
                  ghost
                  loading={cancelEndMutation.isPending}
                >
                  撤销结束
                </Button>
              </Popconfirm>
            )}
          </div>
        )}

        <Space
          direction="vertical"
          size={4}
          style={{ marginTop: 12, width: "100%" }}
        >
          <div className="room-invite">
            邀请码 <b>{room.inviteCode}</b>
            <button
              type="button"
              className="room-invite-copy"
              onClick={copyInviteCode}
            >
              <CopyOutlined /> 复制
            </button>
          </div>
          <div style={{ fontSize: 13, color: "#999" }}>
            创建时间：{new Date(room.createdAt).toLocaleString("zh-CN")}
          </div>
          {room.endedAt && (
            <div style={{ fontSize: 13, color: "#999" }}>
              结束时间：{new Date(room.endedAt).toLocaleString("zh-CN")}
            </div>
          )}
        </Space>
      </Card>

      {/* 实时统计 */}
      <Card
        className="leaderboard"
        title={
          <span>
            <TrophyOutlined style={{ marginRight: 6, color: "#faad14" }} />
            实时排行
          </span>
        }
        style={{ marginBottom: 12 }}
        loading={statsQuery.isLoading}
      >
        {stats && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div className="stat-tile">
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {stats.total.records}
                </div>
                <div style={{ fontSize: 12, color: "#999" }}>记录数</div>
              </div>
              <div className="stat-tile">
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {stats.total.totalQuantity}
                </div>
                <div style={{ fontSize: 12, color: "#999" }}>总数量</div>
              </div>
              <div className="stat-tile">
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {stats.total.totalVolumeMl.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "#999" }}>总容量 ml</div>
              </div>
            </div>

            <Typography.Text strong style={{ fontSize: 13 }}>
              用户排行（按酒精量）
            </Typography.Text>
            {stats.users.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无记录"
                style={{ padding: "12px 0" }}
              />
            ) : (
              <div>{stats.users.map((user, index) => <div className={`rank-row ${user.userId === userId ? "me" : ""}`} key={user.userId}><span className={`rank-no ${index === 0 ? "champion" : ""}`}>{index === 0 ? <TrophyOutlined /> : index + 1}</span><Avatar icon={<UserOutlined />} src={user.avatar || undefined} style={index === 0 ? { backgroundColor: "#e6a23c" } : undefined} /><span className="rank-label"><strong>{user.nickname}{user.userId === userId && <Tag color="processing" style={{ marginLeft: 6 }}>我</Tag>}</strong><Progress percent={maxUserAlcohol ? Math.round((user.alcoholMl / maxUserAlcohol) * 100) : 0} showInfo={false} size="small" /></span><span className="rank-value">{user.quantity} 瓶<br />{user.alcoholMl} ml</span></div>)}</div>
            )}

            <Typography.Text strong style={{ fontSize: 13 }}>
              酒品排行
            </Typography.Text>
            {stats.products.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无记录"
                style={{ padding: "12px 0" }}
              />
            ) : (
              <List
                size="small"
                dataSource={stats.products}
                renderItem={(product) => (
                  <List.Item style={{ padding: "8px 0" }}>
                    <List.Item.Meta
                      title={product.name}
                      description={`${product.volumeMl} ml`}
                    />
                    <div style={{ width: "40%" }}>
                      <Progress
                        percent={
                          maxProductQty > 0
                            ? Math.round(
                                (product.quantity / maxProductQty) * 100,
                              )
                            : 0
                        }
                        size="small"
                        format={() => `${product.quantity} 瓶`}
                      />
                    </div>
                  </List.Item>
                )}
              />
            )}
          </>
        )}
      </Card>

      <Card
        size="small"
        title={
          <span>
            成员列表
            <Typography.Text
              type="secondary"
              style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}
            >
              {members.length} 人
            </Typography.Text>
          </span>
        }
      >
        <div className="room-detail-members" style={{ padding: "8px 0 4px" }}>
          {members.map((member) => (
            <span className="member-chip" key={member.userId}>
              <Avatar
                size={24}
                icon={<UserOutlined />}
                src={member.avatar || undefined}
                style={{
                  backgroundColor:
                    member.role === "OWNER" ? "#e6a23c" : "#8B1E3F",
                }}
              />
              <span style={{ fontSize: 13 }}>
                {member.nickname}
                {member.role === "OWNER" && (
                  <Tag color="gold" style={{ marginLeft: 6 }}>
                    房主
                  </Tag>
                )}
              </span>
            </span>
          ))}
        </div>
      </Card>

      {/* 底部固定操作栏 */}
      <div className="record-action-bar">
        <div className="record-action-bar-inner">
          {room.status === "ACTIVE" && isOwner && (
            <Popconfirm
              title="确定结束该酒局？结束后 15 分钟内可以撤销。"
              onConfirm={() => endMutation.mutate()}
              okText="结束"
            >
              <Button
                size="large"
                loading={endMutation.isPending}
                disabled={cancelEndMutation.isPending}
              >
                结束酒局
              </Button>
            </Popconfirm>
          )}
          <Button
            type="primary"
            size="large"
            icon={<EditOutlined />}
            disabled={room.status !== "ACTIVE"}
            onClick={() => navigate(`/rooms/${id}/drink`)}
          >
            {room.status === "ACTIVE"
              ? "登记饮酒"
              : room.status === "ENDING"
                ? "酒局即将结束"
                : "酒局已结束"}
          </Button>
        </div>
      </div>
    </div>
  );
}
