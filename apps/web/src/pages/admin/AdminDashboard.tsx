import { useQuery } from "@tanstack/react-query";
import { Card, Col, List, Row, Skeleton, Tag, Typography } from "antd";
import {
  UserOutlined,
  HomeOutlined,
  ShoppingOutlined,
  NumberOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { adminApi } from "../../services/admin";
import StatCard from "../../components/common/StatCard";
import PageHeader from "../../components/common/PageHeader";

const ACTION_LABEL: Record<string, string> = {
  USER_STATUS_UPDATE: "修改用户状态",
  USER_ROLE_UPDATE: "修改用户角色",
  PRODUCT_CREATE: "新增商品",
  PRODUCT_UPDATE: "修改商品",
  PRODUCT_DELETE: "删除商品",
  USER_DELETE: "删除用户",
  USER_SOFT_DELETE: "软删除用户",
  ROOM_END_REQUEST: "结束房间",
  ROOM_END_CANCEL: "撤销结束",
  ROOM_FINALIZED: "酒局归档",
  DRINK_RECORD_RESTORE: "恢复饮酒记录",
  PRODUCT_BATCH_DELETE: "批量删除商品",
};

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function TrendBars({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="bar-chart">
      {data.length === 0 && (
        <div
          style={{
            width: "100%",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 13,
            padding: "40px 0",
          }}
        >
          暂无数据
        </div>
      )}
      {data.map((point) => (
        <div
          className="chart-bar"
          key={point.date}
          title={`${point.date}：${point.count}`}
        >
          <i
            style={{
              height: `${Math.max(6, Math.round((point.count / max) * 100))}%`,
            }}
          />
          <span>{formatDate(point.date)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: adminApi.dashboard,
  });
  const analyticsQuery = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => adminApi.analytics(14),
  });

  const isLoading = dashboardQuery.isLoading || analyticsQuery.isLoading;
  const stats = dashboardQuery.data?.stats;
  const analytics = analyticsQuery.data;
  const roomTrends = analytics?.roomTrends ?? [];
  const drinkTrends = analytics?.drinkTrends ?? [];
  const topProducts = analytics?.topProducts ?? [];
  const userRanking = analytics?.userRanking ?? [];
  const activeRooms = analytics?.activeRooms ?? [];

  return (
    <div>
      <PageHeader
        title="运营仪表盘"
        subtitle="酒局活跃情况一览（数据实时来自数据库）"
      />

      {isLoading ? (
        <div className="admin-stat-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            </Card>
          ))}
        </div>
      ) : (
        <div className="admin-stat-grid">
          <StatCard
            icon={<UserOutlined />}
            label="用户总数"
            value={stats?.totalUsers ?? 0}
          />
          <StatCard
            icon={<CheckCircleOutlined />}
            label="活跃用户"
            value={stats?.activeUsers ?? 0}
            accent="green"
          />
          <StatCard
            icon={<HomeOutlined />}
            label="酒局数量"
            value={stats?.totalRooms ?? 0}
            accent="gold"
          />
          <StatCard
            icon={<PlayCircleOutlined />}
            label="进行中酒局"
            value={stats?.activeRooms ?? 0}
            accent="green"
          />
          <StatCard
            icon={<NumberOutlined />}
            label="饮酒记录"
            value={stats?.totalDrinkRecords ?? 0}
          />
          <StatCard
            icon={<ShoppingOutlined />}
            label="商品数量"
            value={stats?.totalProducts ?? 0}
            accent="gold"
          />
        </div>
      )}

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24} lg={12}>
          <Card
            className="chart-card"
            title="酒局趋势"
            extra={
              <Typography.Text type="secondary">最近 14 天新增</Typography.Text>
            }
            loading={isLoading}
          >
            <TrendBars data={roomTrends} />
          </Card>
        </Col>
        <Col span={24} lg={12}>
          <Card
            className="chart-card"
            title="饮酒趋势"
            extra={
              <Typography.Text type="secondary">最近 14 天</Typography.Text>
            }
            loading={isLoading}
          >
            <TrendBars data={drinkTrends} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24} lg={12}>
          <Card
            className="chart-card"
            title="热门酒品 Top10"
            loading={isLoading}
          >
            {topProducts.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--muted)",
                  padding: "48px 0",
                }}
              >
                暂无数据
              </div>
            ) : (
              <div style={{ paddingTop: 8 }}>
                {topProducts.map((p, index) => {
                  const maxQty = Math.max(
                    1,
                    ...topProducts.map((x) => x.quantity),
                  );
                  return (
                    <div
                      key={p.productId}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "26px minmax(0,1fr) 44px",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <Typography.Text
                        type="secondary"
                        style={{ textAlign: "center" }}
                      >
                        {index + 1}
                      </Typography.Text>
                      <div style={{ minWidth: 0 }}>
                        <Typography.Text
                          ellipsis
                          style={{ display: "block", fontSize: 13 }}
                        >
                          {p.name}
                        </Typography.Text>
                        <div
                          style={{
                            height: 8,
                            overflow: "hidden",
                            borderRadius: 99,
                            background: "#f4e9ec",
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(4, Math.round((p.quantity / maxQty) * 100))}%`,
                              height: "100%",
                              borderRadius: 99,
                              background: "#8B1E3F",
                            }}
                          />
                        </div>
                      </div>
                      <Typography.Text
                        type="secondary"
                        style={{ textAlign: "right" }}
                      >
                        {p.quantity}瓶
                      </Typography.Text>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
        <Col span={24} lg={12}>
          <Card
            className="chart-card"
            title="用户饮酒排行 Top10"
            loading={isLoading}
          >
            {userRanking.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--muted)",
                  padding: "48px 0",
                }}
              >
                暂无数据
              </div>
            ) : (
              <List
                size="small"
                dataSource={userRanking}
                renderItem={(u, index) => (
                  <List.Item style={{ padding: "8px 0" }}>
                    <List.Item.Meta
                      avatar={
                        <span
                          style={{
                            display: "inline-flex",
                            width: 24,
                            justifyContent: "center",
                            fontWeight: 700,
                            color: index === 0 ? "#bf7a08" : "var(--muted)",
                          }}
                        >
                          {index + 1}
                        </span>
                      }
                      title={
                        <span style={{ fontSize: 13 }}>
                          {u.nickname || u.username}
                        </span>
                      }
                    />
                    <Typography.Text
                      style={{
                        color: "var(--wine)",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {u.alcoholMl.toFixed(1)}ml 酒精
                    </Typography.Text>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24} md={12}>
          <Card
            size="small"
            title="活跃酒局"
            loading={isLoading}
            styles={{ body: { padding: 0 } }}
          >
            <List
              size="small"
              dataSource={activeRooms}
              locale={{ emptyText: "暂无进行中的酒局" }}
              renderItem={(room) => (
                <List.Item>
                  <List.Item.Meta
                    title={room.name}
                    description={`邀请码 ${room.inviteCode}`}
                  />
                  <Tag color="green">进行中</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={24} md={12}>
          <Card
            size="small"
            title={
              <span>
                <FileTextOutlined style={{ marginRight: 6, color: "#8B1E3F" }} />
                最近操作日志
              </span>
            }
            loading={isLoading}
            styles={{ body: { padding: "8px 16px" } }}
          >
            <List
              size="small"
              dataSource={dashboardQuery.data?.recentLogs ?? []}
              locale={{ emptyText: "暂无日志" }}
              renderItem={(log) => (
                <List.Item style={{ padding: "10px 0" }}>
                  <List.Item.Meta
                    avatar={
                      <span className="log-avatar">
                        <ClockCircleOutlined />
                      </span>
                    }
                    title={
                      <span style={{ fontSize: 13 }}>
                        <Typography.Text strong>
                          {log.admin?.username || "-"}
                        </Typography.Text>
                        <Tag
                          color="blue"
                          style={{ marginLeft: 8, fontSize: 11 }}
                        >
                          {ACTION_LABEL[log.action] || log.action}
                        </Tag>
                      </span>
                    }
                    description={
                      <span className="log-timeline-time">
                        {new Date(log.createdAt).toLocaleString("zh-CN")}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
