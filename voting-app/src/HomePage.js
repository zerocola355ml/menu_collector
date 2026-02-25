import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { getMyRooms, saveRoom, removeRoom } from "./roomStorage";
import { toggleTheme, getTheme } from "./themeUtils";
import "./HomePage.css";

// Firestore 컬렉션 이름
const GROUPS_COLLECTION = "groups";

function HomePage() {
  const [myRooms, setMyRooms] = useState(getMyRooms());
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [theme, setThemeState] = useState(getTheme); // 다크모드 상태
  const navigate = useNavigate();

  // ── 서비스 설정 (관리자 제어) ──
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [serviceMessage, setServiceMessage] = useState("");

  // ── 피드백 (의견 보내기) ──
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("etc");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "service"));
        if (snap.exists()) {
          const data = snap.data();
          setServiceEnabled(data.serviceEnabled ?? true);
          setServiceMessage(data.serviceMessage || "현재 서비스 점검 중입니다.");
        }
      } catch (error) {
        // 설정 문서가 없으면 기본값(활성) 유지
      }
    };
    loadConfig();
  }, []);

  // ── 다크모드 토글 ──
  const handleToggleTheme = () => {
    const next = toggleTheme();
    setThemeState(next);
  };

  // ── 쿨다운 (방 도배 방지) ──
  const lastCreateTime = useRef(0);

  // ── 새 투표방 만들기 ──
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;

    // 쿨다운 체크 (3초)
    const now = Date.now();
    if (now - lastCreateTime.current < 3000) {
      return;
    }
    lastCreateTime.current = now;

    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, GROUPS_COLLECTION), {
        name: trimmed,
        createdAt: serverTimestamp(),
        lastUsedAt: serverTimestamp(),
      });

      // localStorage에 저장
      saveRoom(docRef.id, trimmed);

      setNewGroupName("");
      setShowCreateForm(false);
      navigate(`/g/${docRef.id}`);
    } catch (error) {
      console.error("방 생성 중 오류:", error);
    } finally {
      setCreating(false);
    }
  };

  // ── 내 목록에서 제거 ──
  const handleRemoveRoom = (groupId) => {
    removeRoom(groupId);
    setMyRooms(getMyRooms());
  };

  // ── 피드백 전송 ──
  const handleSendFeedback = async () => {
    const trimmed = feedbackText.trim();
    if (!trimmed) return;

    setFeedbackSending(true);
    try {
      await addDoc(collection(db, "feedback"), {
        text: trimmed,
        category: feedbackCategory,
        groupId: null,
        createdAt: serverTimestamp(),
      });
      setShowFeedback(false);
      setFeedbackText("");
      setFeedbackCategory("etc");
      setFeedbackToast("✅ 소중한 의견 감사합니다!");
      setTimeout(() => setFeedbackToast(""), 2500);
    } catch (error) {
      console.error("피드백 전송 오류:", error);
      setFeedbackToast("❌ 전송에 실패했습니다.");
      setTimeout(() => setFeedbackToast(""), 2500);
    } finally {
      setFeedbackSending(false);
    }
  };

  // ── 시간 포맷 (오늘/어제/날짜) ──
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;

    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="home-app">
      <div className="home-container">
        {/* 헤더 */}
        <header className="home-header">
          <button
            className="theme-toggle home-theme-toggle"
            onClick={handleToggleTheme}
            title="다크모드 전환"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <h1>🍽️ 메뉴 모아</h1>
          <p className="home-subtitle">함께 메뉴를 고르고 투표하세요</p>
        </header>

        {/* 서비스 점검 안내 */}
        {!serviceEnabled && (
          <div className="service-maintenance">
            <span className="maintenance-icon">🔧</span>
            <p>{serviceMessage}</p>
          </div>
        )}

        {/* 새 투표방 만들기 */}
        {serviceEnabled && (
          <>
            {showCreateForm ? (
              <form className="create-room-form" onSubmit={handleCreateGroup}>
                <input
                  type="text"
                  placeholder="투표방 이름 (예: ㅇㅇ팀 점심)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                />
                <div className="create-room-actions">
                  <button
                    type="submit"
                    className="create-confirm-btn"
                    disabled={creating}
                  >
                    {creating ? "생성 중..." : "만들기"}
                  </button>
                  <button
                    type="button"
                    className="create-cancel-btn"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewGroupName("");
                    }}
                  >
                    취소
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="create-room-btn"
                onClick={() => setShowCreateForm(true)}
              >
                🗳️ 새 투표 만들기
              </button>
            )}
          </>
        )}

        {/* 내 투표방 목록 */}
        {myRooms.length > 0 && (
          <section className="my-rooms">
            <h2 className="my-rooms-title">📋 내 투표방</h2>
            <div className="room-list">
              {myRooms.map((room) => (
                <div key={room.groupId} className="room-card">
                  <div
                    className="room-card-body"
                    onClick={() => navigate(`/g/${room.groupId}`)}
                  >
                    <span className="room-icon">📌</span>
                    <div className="room-info">
                      <span className="room-name">{room.groupName}</span>
                      <span className="room-date">
                        {formatDate(room.lastVisited)}
                      </span>
                    </div>
                    <span className="room-arrow">→</span>
                  </div>
                  <button
                    className="room-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveRoom(room.groupId);
                    }}
                    title="목록에서 제거"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 안내 */}
        <div className="home-info">
          <p>💡 친구에게 받은 링크가 있다면 그 링크로 바로 접속하세요!</p>
        </div>

        {/* 푸터 - 의견 보내기 */}
        <div className="home-footer">
          <button
            className="feedback-link"
            onClick={() => setShowFeedback(true)}
          >
            💬 의견 보내기
          </button>
        </div>
      </div>

      {/* 피드백 팝업 */}
      {showFeedback && (
        <div
          className="modal-overlay"
          onClick={() => setShowFeedback(false)}
        >
          <div
            className="feedback-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>💬 의견 보내기</h3>
            <p className="feedback-desc">서비스 개선에 큰 도움이 됩니다</p>

            <div className="feedback-categories">
              {[
                { key: "bug", label: "🐛 버그" },
                { key: "feature", label: "💡 기능 제안" },
                { key: "etc", label: "📝 기타" },
              ].map((cat) => (
                <button
                  key={cat.key}
                  className={`feedback-cat-btn ${feedbackCategory === cat.key ? "active" : ""}`}
                  onClick={() => setFeedbackCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <textarea
              className="feedback-textarea"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="의견을 자유롭게 적어주세요 (최대 500자)"
              maxLength={500}
              rows={4}
              autoFocus
            />
            <span className="feedback-count">{feedbackText.length}/500</span>

            <button
              className="feedback-submit-btn"
              onClick={handleSendFeedback}
              disabled={feedbackSending || !feedbackText.trim()}
            >
              {feedbackSending ? "전송 중..." : "보내기"}
            </button>
            <button
              className="feedback-close-btn"
              onClick={() => setShowFeedback(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 피드백 토스트 */}
      {feedbackToast && <div className="copy-toast">{feedbackToast}</div>}
    </div>
  );
}

export default HomePage;
