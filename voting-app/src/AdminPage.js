import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { toggleTheme, getTheme } from "./themeUtils";
import "./AdminPage.css";

// ── 관리자 비밀키 (환경변수로 분리) ──
const ADMIN_KEY = process.env.REACT_APP_ADMIN_KEY || "admin1234";

// ── Firestore 설정 문서 경로 ──
const CONFIG_DOC = doc(db, "config", "service");

function AdminPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setThemeState] = useState(getTheme);

  // ── 서비스 설정 상태 ──
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [uploadEnabled, setUploadEnabled] = useState(true);
  const [serviceMessage, setServiceMessage] = useState("현재 서비스 점검 중입니다. 잠시 후 다시 시도해주세요.");
  const [uploadMessage, setUploadMessage] = useState("사진 업로드 기능이 일시 중단되었습니다.");

  // ── 다크모드 토글 ──
  const handleToggleTheme = () => {
    const next = toggleTheme();
    setThemeState(next);
  };

  // ── 인증 체크 ──
  useEffect(() => {
    const key = searchParams.get("key");
    if (key === ADMIN_KEY) {
      setAuthorized(true);
      loadConfig();
    } else {
      setAuthorized(false);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Firestore에서 설정 로드 ──
  const loadConfig = async () => {
    try {
      const snap = await getDoc(CONFIG_DOC);
      if (snap.exists()) {
        const data = snap.data();
        setServiceEnabled(data.serviceEnabled ?? true);
        setUploadEnabled(data.uploadEnabled ?? true);
        setServiceMessage(data.serviceMessage || "현재 서비스 점검 중입니다. 잠시 후 다시 시도해주세요.");
        setUploadMessage(data.uploadMessage || "사진 업로드 기능이 일시 중단되었습니다.");
      }
    } catch (error) {
      console.error("설정 로드 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Firestore에 설정 저장 ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(CONFIG_DOC, {
        serviceEnabled,
        uploadEnabled,
        serviceMessage,
        uploadMessage,
      });
      alert("✅ 설정이 저장되었습니다. 모든 사용자에게 즉시 적용됩니다.");
    } catch (error) {
      console.error("설정 저장 오류:", error);
      alert("❌ 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ── 미인증 화면 ──
  if (!authorized) {
    return (
      <div className="admin-app">
        <div className="admin-container">
          <div className="admin-denied">
            <span className="admin-denied-icon">🔒</span>
            <h2>접근 권한이 없습니다</h2>
            <p>올바른 관리자 키가 필요합니다.</p>
            <button className="admin-home-btn" onClick={() => navigate("/")}>
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-app">
        <div className="admin-container">
          <p className="admin-loading">설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <div className="admin-container">
        {/* 헤더 */}
        <header className="admin-header">
          <button
            className="theme-toggle admin-theme-toggle"
            onClick={handleToggleTheme}
            title="다크모드 전환"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <h1>⚙️ 관리자 설정</h1>
          <p className="admin-subtitle">서비스 운영을 제어합니다</p>
        </header>

        {/* 전체 서비스 토글 */}
        <div className={`admin-card ${!serviceEnabled ? "admin-card-danger" : ""}`}>
          <div className="admin-card-header">
            <div className="admin-card-info">
              <h3>🌐 전체 서비스</h3>
              <p>투표방 생성, 투표, 모든 기능을 제어합니다</p>
            </div>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={serviceEnabled}
                onChange={(e) => setServiceEnabled(e.target.checked)}
              />
              <span className="admin-toggle-slider"></span>
            </label>
          </div>
          {!serviceEnabled && (
            <div className="admin-message-area">
              <label>사용자에게 표시할 메시지:</label>
              <textarea
                value={serviceMessage}
                onChange={(e) => setServiceMessage(e.target.value)}
                rows={2}
                placeholder="점검 안내 메시지를 입력하세요"
              />
            </div>
          )}
          <div className="admin-status">
            {serviceEnabled ? (
              <span className="status-on">✅ 정상 운영 중</span>
            ) : (
              <span className="status-off">🚫 서비스 중단됨</span>
            )}
          </div>
        </div>

        {/* 사진 업로드 토글 */}
        <div className={`admin-card ${!uploadEnabled ? "admin-card-warning" : ""}`}>
          <div className="admin-card-header">
            <div className="admin-card-info">
              <h3>📷 사진 업로드</h3>
              <p>메뉴 사진 업로드 기능만 개별 제어합니다</p>
            </div>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={uploadEnabled}
                onChange={(e) => setUploadEnabled(e.target.checked)}
              />
              <span className="admin-toggle-slider"></span>
            </label>
          </div>
          {!uploadEnabled && (
            <div className="admin-message-area">
              <label>사용자에게 표시할 메시지:</label>
              <textarea
                value={uploadMessage}
                onChange={(e) => setUploadMessage(e.target.value)}
                rows={2}
                placeholder="업로드 중단 안내 메시지를 입력하세요"
              />
            </div>
          )}
          <div className="admin-status">
            {uploadEnabled ? (
              <span className="status-on">✅ 업로드 허용</span>
            ) : (
              <span className="status-off">⏸️ 업로드 중단</span>
            )}
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          className="admin-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "저장 중..." : "💾 설정 저장"}
        </button>

        {/* 홈으로 */}
        <button className="admin-home-btn" onClick={() => navigate("/")}>
          ← 홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}

export default AdminPage;
