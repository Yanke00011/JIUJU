import { Button } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <main className="error-page">
      <section className="error-card">
        <div className="error-code">404</div>
        <h1>这杯酒找不到了</h1>
        <p>页面可能被移动，或链接已经失效。</p>
        <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate("/")}>
          回到酒局首页
        </Button>
      </section>
    </main>
  );
}
