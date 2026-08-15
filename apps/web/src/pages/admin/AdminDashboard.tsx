import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row, Statistic, Typography } from "antd";
import {
  UserOutlined,
  HomeOutlined,
  ShoppingOutlined,
  NumberOutlined,
} from "@ant-design/icons";
import { adminApi } from "../../services/admin";

export default function AdminDashboard() {
  const usersQuery = useQuery({
    queryKey: ["admin", "users", "count"],
    queryFn: () => adminApi.users.list(1, 1),
  });
  const roomsQuery = useQuery({
    queryKey: ["admin", "rooms", "count"],
    queryFn: () => adminApi.rooms.list(1, 1),
  });
  const productsQuery = useQuery({
    queryKey: ["admin", "products", "count"],
    queryFn: () => adminApi.products.list(1, 1),
  });
  // 饮酒记录数：遍历房间详情求和（后台未提供全局计数接口）
  const drinksCountQuery = useQuery({
    queryKey: ["admin", "drinks", "count"],
    queryFn: async () => {
      const rooms = await adminApi.rooms.list(1, 100);
      const details = await Promise.all(rooms.items.map((r) => adminApi.rooms.get(r.id)));
      return details.reduce((sum, d) => sum + d.drinkRecordCount, 0);
    },
  });

  const totalUsers = usersQuery.data?.total ?? 0;
  const totalRooms = roomsQuery.data?.total ?? 0;
  const totalProducts = productsQuery.data?.total ?? 0;
  const totalDrinks = drinksCountQuery.data ?? 0;

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        仪表盘
      </Typography.Title>

      <Row gutter={[12, 12]}>
        <Col span={12} xs={12} sm={12}>
          <Card loading={usersQuery.isLoading}>
            <Statistic
              title="用户数量"
              value={totalUsers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} xs={12} sm={12}>
          <Card loading={roomsQuery.isLoading}>
            <Statistic title="房间数量" value={totalRooms} prefix={<HomeOutlined />} />
          </Card>
        </Col>
        <Col span={12} xs={12} sm={12}>
          <Card loading={drinksCountQuery.isLoading}>
            <Statistic
              title="饮酒记录数量"
              value={totalDrinks}
              prefix={<NumberOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} xs={12} sm={12}>
          <Card loading={productsQuery.isLoading}>
            <Statistic
              title="商品数量"
              value={totalProducts}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
