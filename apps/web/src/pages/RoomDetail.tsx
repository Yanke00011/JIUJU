import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  Empty,
  List,
  Progress,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  TrophyOutlined,
  UserOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { roomsApi } from "../services/rooms";
import { statisticsApi } from "../services/statistics";
import { useAuthStore } from "../store/auth";
import type { Room } from "../types/api";

const STATUS_LABEL: Record<Room["status"], { text: string; color: string }> = {
  ACTIVE: { text: "进行中", color: "green" },
  ENDED: { text: "已结束", color: "default" },
};

export default function RoomDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);

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

      <Card style={{ marginBottom: 12 }}>
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
          <Tag color={status.color}>{status.text}</Tag>
        </div>

        <Space
          direction="vertical"
          size={4}
          style={{ marginTop: 12, width: "100%" }}
        >
          <div style={{ fontSize: 14 }}>
            <span style={{ color: "#999" }}>邀请码：</span>
            <span style={{ fontWeight: 600, letterSpacing: 4, fontSize: 16 }}>
              {room.inviteCode}
            </span>
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
        size="small"
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
              <div
                style={{
                  textAlign: "center",
                  background: "#f5f5f5",
                  borderRadius: 8,
                  padding: "8px 0",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {stats.total.records}
                </div>
                <div style={{ fontSize: 12, color: "#999" }}>记录数</div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  background: "#f5f5f5",
                  borderRadius: 8,
                  padding: "8px 0",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {stats.total.totalQuantity}
                </div>
                <div style={{ fontSize: 12, color: "#999" }}>总数量</div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  background: "#f5f5f5",
                  borderRadius: 8,
                  padding: "8px 0",
                }}
              >
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
              <List
                size="small"
                dataSource={stats.users}
                renderItem={(user, index) => (
                  <List.Item style={{ padding: "8px 0" }}>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          icon={<UserOutlined />}
                          src={user.avatar || undefined}
                          style={
                            index === 0
                              ? { backgroundColor: "#faad14" }
                              : undefined
                          }
                        />
                      }
                      title={
                        <span>
                          {index + 1}. {user.nickname}
                          {user.userId === userId && (
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              我
                            </Tag>
                          )}
                        </span>
                      }
                    />
                    <div style={{ width: "40%" }}>
                      <Progress
                        percent={
                          maxUserAlcohol > 0
                            ? Math.round(
                                (user.alcoholMl / maxUserAlcohol) * 100,
                              )
                            : 0
                        }
                        size="small"
                        format={() =>
                          `${user.quantity}瓶 / ${user.alcoholMl}ml酒精`
                        }
                      />
                    </div>
                  </List.Item>
                )}
              />
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
        <List
          loading={membersQuery.isLoading}
          dataSource={members}
          renderItem={(member) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={<UserOutlined />}
                    src={member.avatar || undefined}
                  />
                }
                title={
                  <span>
                    {member.nickname}
                    {member.role === "OWNER" && (
                      <Tag color="gold" style={{ marginLeft: 8 }}>
                        房主
                      </Tag>
                    )}
                  </span>
                }
                description={new Date(member.joinedAt).toLocaleString("zh-CN")}
              />
            </List.Item>
          )}
        />
      </Card>

      {/* 底部固定登记按钮 */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 12,
          background: "#fff",
          borderTop: "1px solid #f0f0f0",
          boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <Button
            type="primary"
            size="large"
            block
            icon={<EditOutlined />}
            disabled={room.status === "ENDED"}
            onClick={() => navigate(`/rooms/${id}/drink`)}
          >
            {room.status === "ENDED" ? "酒局已结束" : "登记饮酒"}
          </Button>
        </div>
      </div>
    </div>
  );
}
