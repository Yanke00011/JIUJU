import { useQuery } from '@tanstack/react-query';
import { Avatar, Button, Card, List, Skeleton, Space, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { roomsApi } from '../services/rooms';
import { useAuthStore } from '../store/auth';
import type { Room } from '../types/api';

const STATUS_LABEL: Record<Room['status'], { text: string; color: string }> = {
  ACTIVE: { text: '进行中', color: 'green' },
  ENDED: { text: '已结束', color: 'default' },
};

export default function RoomDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);

  const roomQuery = useQuery({
    queryKey: ['room', id],
    queryFn: () => roomsApi.detail(id),
  });

  const membersQuery = useQuery({
    queryKey: ['room-members', id],
    queryFn: () => roomsApi.members(id),
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
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Typography.Text>酒局不存在或无法访问</Typography.Text>
        <div>
          <Button style={{ marginTop: 12 }} onClick={() => navigate('/')}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const status = STATUS_LABEL[room.status];
  const members = membersQuery.data ?? [];
  const isOwner = room.ownerId === userId;

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        style={{ marginBottom: 12, padding: 0 }}
      >
        返回
      </Button>

      <Card style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            {room.name}
          </Typography.Title>
          <Tag color={status.color}>{status.text}</Tag>
        </div>

        <Space direction="vertical" size={4} style={{ marginTop: 12, width: '100%' }}>
          <div style={{ fontSize: 14 }}>
            <span style={{ color: '#999' }}>邀请码：</span>
            <span style={{ fontWeight: 600, letterSpacing: 4, fontSize: 16 }}>{room.inviteCode}</span>
          </div>
          <div style={{ fontSize: 13, color: '#999' }}>
            创建时间：{new Date(room.createdAt).toLocaleString('zh-CN')}
          </div>
          {room.endedAt && (
            <div style={{ fontSize: 13, color: '#999' }}>
              结束时间：{new Date(room.endedAt).toLocaleString('zh-CN')}
            </div>
          )}
        </Space>

        {isOwner && (
          <div style={{ marginTop: 12 }}>
            <Button
              type="default"
              danger
              disabled={room.status === 'ENDED'}
              onClick={() => message.info('结束酒局功能将在后续版本开放')}
            >
              结束酒局
            </Button>
          </div>
        )}
      </Card>

      <Card
        size="small"
        title={
          <span>
            成员列表
            <Typography.Text type="secondary" style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
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
                avatar={<Avatar icon={<UserOutlined />} src={member.avatar || undefined} />}
                title={
                  <span>
                    {member.nickname}
                    {member.role === 'OWNER' && (
                      <Tag color="gold" style={{ marginLeft: 8 }}>
                        房主
                      </Tag>
                    )}
                  </span>
                }
                description={new Date(member.joinedAt).toLocaleString('zh-CN')}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
