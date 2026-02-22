// src/roomStorage.js — localStorage 방 목록 관리 유틸리티

const LOCAL_STORAGE_KEY = "vote_eat_my_rooms";
const MAX_ROOMS = 20;

// ── 내 투표방 목록 가져오기 ──
export const getMyRooms = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// ── 투표방 저장 (생성/방문 시) ──
export const saveRoom = (groupId, groupName) => {
  const rooms = getMyRooms();
  const existing = rooms.findIndex((r) => r.groupId === groupId);
  const roomData = { groupId, groupName, lastVisited: Date.now() };

  if (existing >= 0) {
    rooms[existing] = roomData;
  } else {
    rooms.unshift(roomData);
  }

  // 최대 MAX_ROOMS개만 유지
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify(rooms.slice(0, MAX_ROOMS))
  );
};

// ── 내 목록에서 제거 (Firestore는 건드리지 않음) ──
export const removeRoom = (groupId) => {
  const rooms = getMyRooms().filter((r) => r.groupId !== groupId);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rooms));
};
