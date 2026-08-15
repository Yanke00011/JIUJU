import { useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, List, Space, Tag, Typography } from 'antd';
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { roomsApi } from '../services/rooms';
import type { Room } from '../types/api';

const STATUS_LABEL: Record<Room['status'], { text: string; color: string }> = {
  ACTIVE: { text: '进行中', color: 'green' },
  ENDED: { text: '已结束', color: 'default' },
};

export default function Home() {
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: roomsApi.list,
  });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          我的酒局
        </Typography.Title>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => navigate('/rooms/create')}>
            创建酒局
          </Button>
          <Button onClick={() => navigate('/rooms/join')}>加入酒局</Button>
        </Space>
      </div>

      <List
        loading={isLoading}
        locale={{
          emptyText: (
            <Empty description="还没有酒局，创建一个吧" style={{ padding: '32px 0' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/rooms/create')}>
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{room.name}</div>
                  <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
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
