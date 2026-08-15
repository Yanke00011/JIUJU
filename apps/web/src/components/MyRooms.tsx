import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  message,
  Skeleton,
  Space,
  Tabs,
  Tag,
} from "antd";
import {
  TeamOutlined,
  CalendarOutlined,
  CopyOutlined,
  BarsOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import PageHeader from "./common/PageHeader";
import EmptyState from "./common/EmptyState";
import { roomsApi } from "../services/rooms";
import { statisticsApi } from "../services/statistics";
import { useAuthStore } from "../store/auth";
import type { Room } from "../types/api";

/** 每页展示数量（避免一次性渲染大量房间） */
const PAGE_SIZE = 8;

type TabKey = "active" | "history";

/** 通过受限并行请求补充的房间维度信息 */
interface RoomExtra {
  memberCount?: number;
  recordCount?: number;
}

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyRooms() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);

  const [tab, setTab] = useState<TabKey>("active");
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [extra, setExtra] = useState<Record<string, RoomExtra>>({});
  const [enriching, setEnriching] = useState(false);

  const {
    data: rooms,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["rooms"],
    queryFn: roomsApi.list,
  });

  const activeRooms = useMemo(
    () => rooms?.filter((r) => r.status === "ACTIVE") ?? [],
    [rooms],
  );
  const historyRooms = useMemo(
    () => rooms?.filter((r) => r.status === "ENDED") ?? [],
    [rooms],
  );

  const currentPage = tab === "active" ? activePage : historyPage;
  const currentRooms = tab === "active" ? activeRooms : historyRooms;
  const total = currentRooms.length;
  const visible = currentRooms.slice(0, currentPage * PAGE_SIZE);

  const setPage = (next: number) => {
    if (tab === "active") setActivePage(next);
    else setHistoryPage(next);
  };

  const copyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      message.success("邀请码已复制");
    } catch {
      message.error("复制失败，请手动记录");
    }
  };

  /**
   * 对当前可见房间补充成员数 / 历史饮酒量。
   * 仅请求本页尚未补充的房间，失败自动跳过，避免 N+1 拖垮列表。
   */
  useEffect(() => {
    const pageRooms = (tab === "active" ? activeRooms : historyRooms).slice(
      0,
      currentPage * PAGE_SIZE,
    );
    const missing = pageRooms.filter((r) => !extra[r.id]);
    if (missing.length === 0) return;
    let cancelled = false;
    setEnriching(true);
    Promise.allSettled(
      missing.map(async (room) => {
        const [membersRes, statsRes] = await Promise.all([
          roomsApi.members(room.id),
          tab === "history"
            ? statisticsApi.getRoomStatistics(room.id)
            : Promise.resolve(undefined),
        ]);
        return {
          roomId: room.id,
          memberCount: membersRes.length,
          recordCount: statsRes ? statsRes.total.records : undefined,
        };
      }),
    ).then((results) => {
      if (cancelled) return;
      let hasUpdate = false;
      const next = { ...extra };
      results.forEach((res) => {
        if (res.status === "fulfilled") {
          hasUpdate = true;
          next[res.value.roomId] = {
            memberCount: res.value.memberCount,
            recordCount: res.value.recordCount,
          };
        }
      });
      if (hasUpdate) {
        setExtra(next);
      }
      setEnriching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, currentPage, activeRooms, historyRooms, extra]);

  const renderSkeleton = () => (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Card>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
      <Card>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    </Space>
  );

  const renderActiveCard = (room: Room) => (
    <Card className="room-list-card" key={room.id} styles={{ body: { padding: 18 } }}>
      <div className="room-list-head">
        <div className="room-list-title">
          <span className="room-list-name">{room.name}</span>
          {room.ownerId === userId && <Tag color="gold">房主</Tag>}
        </div>
        <Tag color="success">进行中</Tag>
      </div>
      <div className="room-list-meta">
        <span>
          <TeamOutlined />
          {enriching && !extra[room.id] ? "…" : (extra[room.id]?.memberCount ?? "-")} 人参与
        </span>
        <span>
          <CalendarOutlined />
          {formatDateTime(room.createdAt)} 创建
        </span>
      </div>
      <div className="room-list-invite">
        <span>
          邀请码 <b>{room.inviteCode}</b>
        </span>
        <button
          type="button"
          className="room-invite-copy"
          onClick={() => copyInvite(room.inviteCode)}
        >
          <CopyOutlined /> 复制
        </button>
      </div>
      <Button
        type="primary"
        block
        size="large"
        onClick={() => navigate(`/rooms/${room.id}`)}
      >
        进入酒局
      </Button>
    </Card>
  );

  const renderHistoryCard = (room: Room) => {
    const info = extra[room.id];
    return (
      <Card className="room-list-card" key={room.id} styles={{ body: { padding: 18 } }}>
        <div className="room-list-head">
          <div className="room-list-title">
            <span className="room-list-name">{room.name}</span>
            {room.ownerId === userId && <Tag color="gold">房主</Tag>}
          </div>
          <Tag>已结束</Tag>
        </div>
        <div className="room-list-meta">
          <span>
            <TeamOutlined />
            {enriching && !info ? "…" : (info?.memberCount ?? "-")} 人参与
          </span>
          <span>
            <BarsOutlined />
            共 {enriching && !info ? "…" : (info?.recordCount ?? "-")} 杯
          </span>
        </div>
        <div className="room-list-meta">
          <span>
            <CalendarOutlined />
            {formatDateTime(room.endedAt ?? room.createdAt)} 结束
          </span>
        </div>
        <Button block size="large" onClick={() => navigate(`/rooms/${room.id}`)}>
          查看详情
        </Button>
      </Card>
    );
  };

  const loadMore =
    total > currentPage * PAGE_SIZE ? (
      <Button block onClick={() => setPage(currentPage + 1)}>
        加载更多（已显示 {Math.min(total, currentPage * PAGE_SIZE)} / {total}）
      </Button>
    ) : total > PAGE_SIZE ? (
      <div className="room-list-end">已全部加载 · 共 {total} 个</div>
    ) : null;

  return (
    <div>
      <PageHeader
        title="我的酒局"
        subtitle="把每一次碰杯，都记得清清楚楚。"
        extra={
          <>
            <Button onClick={() => navigate("/rooms/join")}>加入</Button>
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
        renderSkeleton()
      ) : isError ? (
        <Card>
          <EmptyState
            description="酒局列表加载失败"
            hint="请检查网络后重试"
            action={
              <Button type="primary" onClick={() => refetch()}>
                重新加载
              </Button>
            }
          />
        </Card>
      ) : (
        <Tabs
          className="room-list-tabs"
          activeKey={tab}
          onChange={(key) => {
            setTab(key as TabKey);
          }}
          items={[
            {
              key: "active",
              label: `进行中 (${activeRooms.length})`,
              children: (
                <div className="room-list">
                  {activeRooms.length === 0 ? (
                    <Card>
                      <EmptyState
                        description="暂无进行中的酒局"
                        hint="开一桌新的，叫上朋友开始记录"
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
                    <>
                      {visible.map(renderActiveCard)}
                      {loadMore}
                    </>
                  )}
                </div>
              ),
            },
            {
              key: "history",
              label: `历史 (${historyRooms.length})`,
              children: (
                <div className="room-list">
                  {historyRooms.length === 0 ? (
                    <Card>
                      <EmptyState
                        description="暂无历史酒局"
                        hint="结束的酒局会归档到这里"
                      />
                    </Card>
                  ) : (
                    <>
                      {visible.map(renderHistoryCard)}
                      {loadMore}
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
