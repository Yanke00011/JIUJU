import {
  Button,
} from "antd";
import {
  CameraOutlined,
  CrownOutlined,
  GiftOutlined,
  GithubOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import MyRooms from "../components/MyRooms";
import { useAuthStore } from "../store/auth";

const GITHUB_URL = "https://github.com/Yanke00011/JIUJU";

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
          <div className="landing-nav-actions">
            <Button
              type="text"
              icon={<GithubOutlined />}
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#fff" }}
            >
              GitHub
            </Button>
            <Button
              type="text"
              style={{ color: "#fff" }}
              onClick={() => navigate("/login")}
            >
              登录
            </Button>
          </div>
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
