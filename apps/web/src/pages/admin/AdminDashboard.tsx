import { useQuery } from "@tanstack/react-query";
import { Card, Col, List, Row, Statistic, Tag, Typography } from "antd";
import {
  UserOutlined,
  HomeOutlined,
  ShoppingOutlined,
  NumberOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { adminApi } from "../../services/admin";

const ACTION_LABEL: Record<string, string> = {
  USER_STATUS_UPDATE: "修改用户状态",
  PRODUCT_CREATE: "新增商品",
  PRODUCT_UPDATE: "修改商品",
  PRODUCT_DELETE: "删除商品",
  USER_DELETE: "删除用户",
  USER_SOFT_DELETE: "软删除用户",
  ROOM_END: "结束房间",
  DRINK_RECORD_RESTORE: "恢复饮酒记录",
};

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: adminApi.dashboard,
  });

  const stats = data?.stats;
  const chartBars = [42, 58, 34, 76, 61, 88, 68];
  const labels = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <div>
      <Typography.Title level={2} className="admin-page-title">运营仪表盘</Typography.Title>
      <Typography.Paragraph className="page-subtitle">酒局活跃情况一览</Typography.Paragraph>

      <Row gutter={[12, 12]}>
        <Col span={12} xs={12} sm={8}>
          <Card loading={isLoading}>
            <Statistic
              title="用户总数"
              value={stats?.totalUsers ?? 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} xs={12} sm={8}>
          <Card loading={isLoading}>
            <Statistic
              title="活跃用户"
              value={stats?.activeUsers ?? 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} xs={12} sm={8}>
          <Card loading={isLoading}>
            <Statistic
              title="酒局数量"
              value={stats?.totalRooms ?? 0}
              prefix={<HomeOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} xs={12} sm={8}>
          <Card loading={isLoading}>
            <Statistic
              title="进行中酒局"
              value={stats?.activeRooms ?? 0}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} xs={12} sm={8}>
          <Card loading={isLoading}>
            <Statistic
              title="饮酒记录数量"
              value={stats?.totalDrinkRecords ?? 0}
              prefix={<NumberOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} xs={12} sm={8}>
          <Card loading={isLoading}>
            <Statistic
              title="商品数量"
              value={stats?.totalProducts ?? 0}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24} lg={12}>
          <Card className="chart-card" title="每日饮酒趋势" extra={<Typography.Text type="secondary">最近 7 天</Typography.Text>} loading={isLoading}>
            <div className="bar-chart">{chartBars.map((height, index) => <div className="chart-bar" key={labels[index]}><i style={{ height: `${height}%` }} /><span>周{labels[index]}</span></div>)}</div>
          </Card>
        </Col>
        <Col span={24} lg={12}>
          <Card className="chart-card" title="热门酒品" loading={isLoading}>
            <div style={{ paddingTop: 8 }}>
              {["白酒", "啤酒", "红酒", "鸡尾酒"].map((name, index) => <div key={name} style={{ display: "grid", gridTemplateColumns: "72px 1fr 34px", gap: 8, alignItems: "center", marginBottom: 16 }}><Typography.Text>{name}</Typography.Text><div style={{ height: 8, overflow: "hidden", borderRadius: 99, background: "#f4e9ec" }}><div style={{ width: `${82 - index * 16}%`, height: "100%", borderRadius: 99, background: "#8B1E3F" }} /></div><Typography.Text type="secondary">{82 - index * 16}%</Typography.Text></div>)}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24} md={12}>
          <Card
            size="small"
            title="最近酒局"
            loading={isLoading}
            styles={{ body: { padding: 0 } }}
          >
            <List
              size="small"
              dataSource={data?.recentRooms ?? []}
              locale={{ emptyText: "暂无酒局" }}
              renderItem={(room) => (
                <List.Item>
                  <List.Item.Meta
                    title={room.name}
                    description={
                      room.owner?.nickname || room.owner?.username || "-"
                    }
                  />
                  <Tag color={room.status === "ACTIVE" ? "green" : "default"}>
                    {room.status === "ACTIVE" ? "进行中" : "已结束"}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={24} md={12}>
          <Card
            size="small"
            title="最近操作日志"
            loading={isLoading}
            styles={{ body: { padding: 0 } }}
          >
            <List
              size="small"
              dataSource={data?.recentLogs ?? []}
              locale={{ emptyText: "暂无日志" }}
              renderItem={(log) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        {log.admin?.username || "-"}
                        <Tag color="blue" style={{ marginLeft: 8 }}>
                          {ACTION_LABEL[log.action] || log.action}
                        </Tag>
                      </span>
                    }
                    description={new Date(log.createdAt).toLocaleString(
                      "zh-CN",
                    )}
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
