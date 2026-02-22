import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import { saveRoom, removeRoom } from "./roomStorage";
import "./App.css";

// Firestore 컬렉션 이름
const GROUPS_COLLECTION = "groups";

// ── 만료 시간 (24시간) ──
const EXPIRATION_MS = 24 * 60 * 60 * 1000;

function App() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  // ── 그룹 정보 ──
  const [groupName, setGroupName] = useState("");
  const [name, setName] = useState("");
  const [item, setItem] = useState("");
  const [voteList, setVoteList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ── 이미지 관련 상태 ──
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [modalImage, setModalImage] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [quickJoinTarget, setQuickJoinTarget] = useState(null); // 빠른 참여 팝업 대상
  const [quickJoinName, setQuickJoinName] = useState(""); // 팝업 이름 입력
  const [showNewGroup, setShowNewGroup] = useState(false); // 새 그룹 팝업
  const [newGroupName, setNewGroupName] = useState(""); // 새 그룹 이름
  const carouselRef = useRef(null);
  const quickJoinInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── 쿨다운 (연타/자동화 방지) ──
  const cooldownRef = useRef({});
  const [cooldownActive, setCooldownActive] = useState({});

  const isCooldown = (action, ms) => {
    const now = Date.now();
    if (cooldownRef.current[action] && now - cooldownRef.current[action] < ms) {
      return true;
    }
    cooldownRef.current[action] = now;
    setCooldownActive((prev) => ({ ...prev, [action]: true }));
    setTimeout(() => {
      setCooldownActive((prev) => ({ ...prev, [action]: false }));
    }, ms);
    return false;
  };

  // ── 만료된 방 정리 (서브컬렉션 + Storage + 그룹 문서 삭제) ──
  const cleanupExpiredRoom = async (gId) => {
    try {
      // 투표 삭제
      const votesSnap = await getDocs(
        collection(db, GROUPS_COLLECTION, gId, "votes")
      );
      for (const d of votesSnap.docs) {
        await deleteDoc(doc(db, GROUPS_COLLECTION, gId, "votes", d.id));
      }

      // 이미지 삭제 (Storage + Firestore)
      const imagesSnap = await getDocs(
        collection(db, GROUPS_COLLECTION, gId, "menuImages")
      );
      for (const d of imagesSnap.docs) {
        const data = d.data();
        const path =
          data.storagePath || `groups/${gId}/menu-images/${data.fileName}`;
        try {
          await deleteObject(ref(storage, path));
        } catch (e) {
          // Storage 파일이 없어도 무시
        }
        await deleteDoc(
          doc(db, GROUPS_COLLECTION, gId, "menuImages", d.id)
        );
      }

      // 그룹 문서 삭제
      await deleteDoc(doc(db, GROUPS_COLLECTION, gId));
    } catch (error) {
      console.error("만료된 방 정리 중 오류:", error);
    }
  };

  // ── 만료 체크 (최초 1회, 방 진입 시) ──
  const [expired, setExpired] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null); // 만료 예정 시각
  const [remainingTime, setRemainingTime] = useState(""); // 남은 시간 문자열

  useEffect(() => {
    if (!groupId) return;

    const checkExpiration = async () => {
      try {
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        const snap = await getDoc(groupRef);

        // 방이 존재하지 않으면 → 홈으로 이동
        if (!snap.exists()) {
          removeRoom(groupId);
          navigate("/", { replace: true });
          return;
        }

        const data = snap.data();
        // lastUsedAt이 없으면 createdAt을 fallback으로 사용
        const lastUsed =
          data.lastUsedAt?.toDate?.() || data.createdAt?.toDate?.();

        if (lastUsed && Date.now() - lastUsed.getTime() > EXPIRATION_MS) {
          // 만료 → 데이터 정리 후 홈으로 이동
          setExpired(true);
          await cleanupExpiredRoom(groupId);
          removeRoom(groupId);
          alert("⏰ 이 투표방은 24시간 동안 사용되지 않아 만료되었습니다.");
          navigate("/", { replace: true });
          return;
        }

        // 만료되지 않았으면 → 만료 예정 시각 저장 & 방문 시각 갱신
        setExpiresAt(new Date(lastUsed.getTime() + EXPIRATION_MS));
        await updateDoc(groupRef, { lastUsedAt: serverTimestamp() });
      } catch (error) {
        console.error("만료 체크 중 오류:", error);
      }
    };

    checkExpiration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // ── 활동 시 lastUsedAt 갱신 ──
  const touchRoom = async () => {
    if (!groupId) return;
    try {
      await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
        lastUsedAt: serverTimestamp(),
      });
      // 만료 시각도 갱신 (지금부터 24시간)
      setExpiresAt(new Date(Date.now() + EXPIRATION_MS));
    } catch (error) {
      // 삭제된 방 등 무시
    }
  };

  // ── 만료 카운트다운 타이머 (1분마다 갱신) ──
  useEffect(() => {
    if (!expiresAt) return;

    const updateRemaining = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setRemainingTime("곧 만료됩니다");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) {
        setRemainingTime(`${hours}시간 ${minutes}분 후 만료`);
      } else {
        setRemainingTime(`${minutes}분 후 만료`);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 60000); // 1분마다
    return () => clearInterval(interval);
  }, [expiresAt]);

  // ── 그룹 정보 리스너 & localStorage 저장 ──
  useEffect(() => {
    if (!groupId || expired) return;

    // 현재 그룹 이름 가져오기
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const unsubGroup = onSnapshot(groupRef, (snap) => {
      if (snap.exists()) {
        const gName = snap.data().name || "";
        setGroupName(gName);
        // localStorage에 방 저장 (공유 링크로 들어온 사용자도 기록)
        if (gName) saveRoom(groupId, gName);
      }
    });

    return () => unsubGroup();
  }, [groupId, expired]);

  // ── Firestore 실시간 리스너 (투표) ──
  useEffect(() => {
    if (!groupId) return;

    const unsubscribe = onSnapshot(
      collection(db, GROUPS_COLLECTION, groupId, "votes"),
      (snapshot) => {
        const votes = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // count 기준 내림차순 정렬
        votes.sort((a, b) => b.count - a.count);
        setVoteList(votes);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  // ── Firestore 실시간 리스너 (이미지) ──
  useEffect(() => {
    if (!groupId) return;

    const q = query(
      collection(db, GROUPS_COLLECTION, groupId, "menuImages"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const imgs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setImages(imgs);
    });

    return () => unsubscribe();
  }, [groupId]);

  // ── 투표 제출 처리 ──
  const handleVote = async (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedItem = item.trim();

    if (!trimmedName || !trimmedItem) {
      setMessage("이름과 항목을 모두 입력해주세요!");
      return;
    }

    // 쿨다운 체크 (2초)
    if (isCooldown("vote", 2000)) {
      setMessage("⏳ 잠시 후 다시 시도해주세요.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const docId = trimmedItem.toLowerCase();
      const voteRef = doc(db, GROUPS_COLLECTION, groupId, "votes", docId);
      const voteSnap = await getDoc(voteRef);

      if (voteSnap.exists()) {
        await updateDoc(voteRef, {
          count: increment(1),
          voters: arrayUnion(trimmedName),
        });
        setMessage(`"${trimmedItem}" 항목에 투표했습니다!`);
      } else {
        await setDoc(voteRef, {
          name: trimmedItem,
          count: 1,
          voters: [trimmedName],
        });
        setMessage(`"${trimmedItem}" 항목이 새로 추가되었습니다!`);
      }

      setName("");
      setItem("");
      touchRoom(); // 활동 시각 갱신
    } catch (error) {
      console.error("투표 처리 중 오류:", error);
      setMessage("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // ── 이미지 압축 유틸리티 ──
  const compressImage = (file, maxWidth = 1920, maxHeight = 1920, quality = 0.7) => {
    return new Promise((resolve) => {
      // 이미지가 아닌 파일은 그대로 반환
      if (!file.type.startsWith("image/")) {
        resolve(file);
        return;
      }
      // 500KB 이하의 작은 파일은 압축 생략
      if (file.size <= 500 * 1024) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          // 최대 크기 초과 시 비율 유지하며 리사이즈
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              console.log(
                `📷 이미지 압축: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% 절감)`
              );
              resolve(compressedFile);
            },
            "image/jpeg",
            quality
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // ── 이미지 업로드 처리 ──
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 쿨다운 체크 (5초)
    if (isCooldown("upload", 5000)) {
      setMessage("⏳ 업로드는 잠시 후 다시 시도해주세요.");
      return;
    }

    // 이미지 개수 제한 (방당 최대 20장)
    if (images.length + files.length > 20) {
      setMessage("📷 사진은 최대 20장까지 업로드할 수 있습니다.");
      return;
    }

    setUploading(true);

    try {
      for (const file of files) {
        // 이미지 압축 (최대 1920px, JPEG 품질 70%)
        const compressedFile = await compressImage(file);

        // 고유 파일명 생성 (그룹별 Storage 경로)
        const fileName = `${Date.now()}_${file.name}`;
        const storagePath = `groups/${groupId}/menu-images/${fileName}`;
        const storageRef = ref(storage, storagePath);

        // Firebase Storage에 압축된 이미지 업로드
        await uploadBytes(storageRef, compressedFile);
        const downloadURL = await getDownloadURL(storageRef);

        // Firestore에 이미지 메타데이터 저장 (실시간 동기화용)
        await addDoc(collection(db, GROUPS_COLLECTION, groupId, "menuImages"), {
          url: downloadURL,
          fileName: file.name,
          storagePath: storagePath,
          createdAt: serverTimestamp(),
        });
      }
      setMessage(`${files.length}장의 사진이 업로드되었습니다!`);
      touchRoom(); // 활동 시각 갱신
    } catch (error) {
      console.error("이미지 업로드 중 오류:", error);
      setMessage("이미지 업로드에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploading(false);
      // input 초기화 (같은 파일 재선택 가능하도록)
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ── 캐러셀 네비게이션 ──
  const scrollToSlide = (index) => {
    if (carouselRef.current) {
      const slideWidth = carouselRef.current.offsetWidth;
      carouselRef.current.scrollTo({
        left: slideWidth * index,
        behavior: "smooth",
      });
      setCurrentSlide(index);
    }
  };

  const handlePrev = () => {
    const newIndex = currentSlide > 0 ? currentSlide - 1 : images.length - 1;
    scrollToSlide(newIndex);
  };

  const handleNext = () => {
    const newIndex = currentSlide < images.length - 1 ? currentSlide + 1 : 0;
    scrollToSlide(newIndex);
  };

  // ── 스크롤 이벤트로 현재 슬라이드 인덱스 동기화 ──
  const handleCarouselScroll = () => {
    if (carouselRef.current) {
      const slideWidth = carouselRef.current.offsetWidth;
      const scrollLeft = carouselRef.current.scrollLeft;
      const newIndex = Math.round(scrollLeft / slideWidth);
      setCurrentSlide(newIndex);
    }
  };

  // ── 이미지 삭제 처리 ──
  const handleDeleteImage = async (img) => {
    if (deleting) return;

    const confirmed = window.confirm("이 사진을 삭제하시겠습니까?");
    if (!confirmed) return;

    setDeleting(img.id);

    try {
      // Storage에서 파일 삭제 (storagePath가 있으면 사용, 없으면 fileName으로 시도)
      const path = img.storagePath || `menu-images/${img.fileName}`;
      const storageRef = ref(storage, path);
      try {
        await deleteObject(storageRef);
      } catch (storageError) {
        // Storage 파일이 이미 없어도 Firestore 문서는 삭제 진행
        console.warn("Storage 파일 삭제 실패 (이미 삭제됨):", storageError);
      }

      // Firestore에서 문서 삭제
      await deleteDoc(doc(db, GROUPS_COLLECTION, groupId, "menuImages", img.id));

      // 슬라이드 인덱스 보정
      if (currentSlide >= images.length - 1 && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      }

      setMessage("사진이 삭제되었습니다.");
    } catch (error) {
      console.error("이미지 삭제 중 오류:", error);
      setMessage("사진 삭제에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setDeleting(null);
    }
  };

  // ── 투표 항목 전체 삭제 ──
  const handleDeleteVoteItem = async (voteItem) => {
    const confirmed = window.confirm(
      `"${voteItem.name}" 항목을 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, GROUPS_COLLECTION, groupId, "votes", voteItem.id));
      setMessage(`"${voteItem.name}" 항목이 삭제되었습니다.`);
    } catch (error) {
      console.error("항목 삭제 중 오류:", error);
      setMessage("항목 삭제에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // ── 개별 투표자 삭제 ──
  const handleRemoveVoter = async (voteItem, voterName) => {
    const confirmed = window.confirm(
      `"${voteItem.name}" 항목에서 "${voterName}"님을 삭제하시겠습니까?`
    );
    if (!confirmed) return;

    try {
      const newVoters = voteItem.voters.filter((v) => v !== voterName);
      const newCount = voteItem.count - 1;

      if (newVoters.length === 0 || newCount <= 0) {
        // 투표자가 0명이면 항목 자체를 삭제
        await deleteDoc(doc(db, GROUPS_COLLECTION, groupId, "votes", voteItem.id));
        setMessage(
          `"${voterName}"님 삭제 → "${voteItem.name}" 항목이 비어서 삭제되었습니다.`
        );
      } else {
        // 투표자 배열에서 제거 + count 감소
        await updateDoc(doc(db, GROUPS_COLLECTION, groupId, "votes", voteItem.id), {
          voters: arrayRemove(voterName),
          count: increment(-1),
        });
        setMessage(
          `"${voteItem.name}" 항목에서 "${voterName}"님을 삭제했습니다.`
        );
      }
    } catch (error) {
      console.error("투표자 삭제 중 오류:", error);
      setMessage("투표자 삭제에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // ── 기존 항목에 빠른 참여 ──
  const handleQuickJoin = (voteItem) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      // 이름이 비었으면 팝업 띄우기
      setQuickJoinTarget(voteItem);
      setQuickJoinName("");
      // 다음 렌더 후 input에 포커스
      setTimeout(() => quickJoinInputRef.current?.focus(), 50);
      return;
    }

    // 이름이 있으면 바로 참여
    submitQuickJoin(voteItem, trimmedName);
  };

  // ── 빠른 참여 실제 제출 ──
  const submitQuickJoin = async (voteItem, joinName) => {
    // 쿨다운 체크 (2초)
    if (isCooldown("quickJoin", 2000)) {
      setMessage("⏳ 잠시 후 다시 시도해주세요.");
      return;
    }

    try {
      await updateDoc(doc(db, GROUPS_COLLECTION, groupId, "votes", voteItem.id), {
        count: increment(1),
        voters: arrayUnion(joinName),
      });
      setMessage(`"${voteItem.name}" 항목에 "${joinName}"님이 참여했습니다!`);
      setName("");
      setQuickJoinTarget(null);
      setQuickJoinName("");
      touchRoom(); // 활동 시각 갱신
    } catch (error) {
      console.error("빠른 참여 중 오류:", error);
      setMessage("참여에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // ── 빠른 참여 팝업 확인 ──
  const handleQuickJoinSubmit = (e) => {
    e.preventDefault();
    const trimmed = quickJoinName.trim();
    if (!trimmed || !quickJoinTarget) return;

    setName(trimmed); // 상단 이름 칸에도 반영
    submitQuickJoin(quickJoinTarget, trimmed);
  };

  // ── 새 그룹 생성 ──
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;

    // 쿨다운 체크 (3초)
    if (isCooldown("createGroup", 3000)) {
      setMessage("⏳ 잠시 후 다시 시도해주세요.");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, GROUPS_COLLECTION), {
        name: trimmed,
        createdAt: serverTimestamp(),
        lastUsedAt: serverTimestamp(),
      });
      // localStorage에 저장
      saveRoom(docRef.id, trimmed);
      setShowNewGroup(false);
      setNewGroupName("");
      navigate(`/g/${docRef.id}`);
    } catch (error) {
      console.error("그룹 생성 중 오류:", error);
      setMessage("그룹 생성에 실패했습니다.");
    }
  };

  // ── 링크 공유 (URL 클립보드 복사) ──
  const handleShareLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("📋 링크가 복사되었습니다! 친구에게 공유하세요.");
    } catch {
      // 클립보드 API 실패 시 fallback
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setMessage("📋 링크가 복사되었습니다! 친구에게 공유하세요.");
    }
  };

  // ── 메뉴 가격 업데이트 ──
  const handleUpdatePrice = async (voteItem, newPrice) => {
    try {
      const priceValue = newPrice === "" ? 0 : parseInt(newPrice, 10);
      if (isNaN(priceValue) || priceValue < 0) return;

      await updateDoc(doc(db, GROUPS_COLLECTION, groupId, "votes", voteItem.id), {
        price: priceValue,
      });
    } catch (error) {
      console.error("가격 업데이트 중 오류:", error);
      setMessage("가격 업데이트에 실패했습니다.");
    }
  };

  // ── 전체 리셋 (투표 + 사진 모두 삭제) ──
  const [resetting, setResetting] = useState(false);
  const [showCopyPopup, setShowCopyPopup] = useState(false); // 주문 복사 팝업
  const [copyToast, setCopyToast] = useState(""); // 복사 완료 토스트

  // ── 주문 요약 복사 ──
  const handleCopyOrder = async (includeVoters) => {
    if (voteList.length === 0) return;

    const header = groupName ? `[${groupName}]` : "[주문 요약]";
    const lines = voteList.map((v) => {
      let line = `${v.name} ${v.count}`;
      if (includeVoters && v.voters && v.voters.length > 0) {
        line += ` — ${v.voters.join(", ")}`;
      }
      return line;
    });

    const totalCount = voteList.reduce((sum, v) => sum + v.count, 0);
    const totalAmount = voteList.reduce(
      (sum, v) => sum + (v.price || 0) * v.count,
      0
    );

    let footer = `총 ${totalCount}명`;
    if (totalAmount > 0) {
      footer += ` / ${totalAmount.toLocaleString()}원`;
    }

    const text = [header, ...lines, footer].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setShowCopyPopup(false);
      setCopyToast("✅ 복사되었습니다!");
      setTimeout(() => setCopyToast(""), 2000);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  };

  // ── 전체 초기화 ──
  const handleResetAll = async () => {
    const confirmed = window.confirm(
      "⚠️ 모든 투표 내용과 사진이 삭제됩니다.\n정말 초기화하시겠습니까?"
    );
    if (!confirmed) return;

    setResetting(true);

    try {
      // 1. 모든 투표 문서 삭제
      const votesSnap = await getDocs(
        collection(db, GROUPS_COLLECTION, groupId, "votes")
      );
      const voteDeletes = votesSnap.docs.map((d) =>
        deleteDoc(doc(db, GROUPS_COLLECTION, groupId, "votes", d.id))
      );

      // 2. 모든 이미지 문서 + Storage 파일 삭제
      const imagesSnap = await getDocs(
        collection(db, GROUPS_COLLECTION, groupId, "menuImages")
      );
      const imageDeletes = imagesSnap.docs.map(async (d) => {
        const data = d.data();
        const path = data.storagePath || `groups/${groupId}/menu-images/${data.fileName}`;
        try {
          await deleteObject(ref(storage, path));
        } catch (e) {
          // Storage 파일이 없어도 무시
        }
        return deleteDoc(doc(db, GROUPS_COLLECTION, groupId, "menuImages", d.id));
      });

      await Promise.all([...voteDeletes, ...imageDeletes]);

      setCurrentSlide(0);
      setMessage("모든 데이터가 초기화되었습니다.");
    } catch (error) {
      console.error("리셋 중 오류:", error);
      setMessage("초기화에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setResetting(false);
    }
  };

  // ── 전체화면 모달 열기/닫기 ──
  const openModal = (img) => setModalImage(img);
  const closeModal = () => setModalImage(null);

  // ── 전체 투표 수 & 총 금액 계산 ──
  const totalVotes = voteList.reduce((sum, v) => sum + v.count, 0);
  const totalPrice = voteList.reduce((sum, v) => sum + (v.price || 0) * v.count, 0);

  return (
    <div className="App">
      <div className="container">
        {/* 헤더 */}
        <header className="header">
          <div className="header-top">
            <h1>메뉴 모아</h1>
            <button
              className="reset-btn"
              onClick={handleResetAll}
              disabled={resetting}
              title="전체 초기화"
            >
              {resetting ? "⏳" : "↻"}
            </button>
          </div>
          {groupName && (
            <div className="group-badge-row">
              <button
                className="back-btn-small"
                onClick={() => navigate("/")}
                title="홈으로"
              >
                ←
              </button>
              <span className="group-badge">📌 {groupName}</span>
              <button
                className="share-btn-small"
                onClick={handleShareLink}
                title="링크 공유"
              >
                🔗
              </button>
              <button
                className="add-group-small-btn"
                onClick={() => {
                  setShowNewGroup(true);
                  setNewGroupName("");
                }}
                title="새 투표방 만들기"
              >
                +
              </button>
            </div>
          )}
          <p className="subtitle">이름과 메뉴를 입력하고 투표하세요!</p>
        </header>

        {/* 투표 폼 */}
        <form className="vote-form" onSubmit={handleVote}>
          <div className="input-group">
            <label htmlFor="name">이름</label>
            <input
              id="name"
              type="text"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="item">메뉴</label>
            <input
              id="item"
              type="text"
              placeholder="메뉴를 입력하거나 아래 현황에서 +참여를 눌러주세요."
              value={item}
              onChange={(e) => setItem(e.target.value)}
            />
          </div>
          <button type="submit" className="vote-btn" disabled={loading || cooldownActive.vote}>
            {loading ? "제출 중..." : cooldownActive.vote ? "⏳ 잠시만..." : "제출하기"}
          </button>
        </form>

        {/* 메시지 */}
        {message && <p className="message">{message}</p>}

        {/* 투표 현황 */}
        <section className="results">
          <div className="results-header">
            <h2>
              📊 투표 현황{" "}
              <span className="total-badge">총 {totalVotes}표</span>
            </h2>
            {voteList.length > 0 && (
              <button
                className="copy-order-btn"
                onClick={() => setShowCopyPopup(true)}
                title="주문 요약 복사"
              >
                📋 주문 복사
              </button>
            )}
          </div>

          {voteList.length === 0 ? (
            <p className="empty">아직 투표가 없습니다. 첫 번째로 투표해보세요!</p>
          ) : (
            <>
              <ul className="vote-list">
                {voteList.map((v, index) => {
                  const percentage =
                    totalVotes > 0
                      ? ((v.count / totalVotes) * 100).toFixed(1)
                      : 0;
                  const itemTotal = (v.price || 0) * v.count;
                  return (
                    <li key={v.id} className="vote-item">
                      <div className="vote-item-header">
                        <span className="rank">#{index + 1}</span>
                        <span className="vote-name">{v.name}</span>
                        <span className="vote-count">{v.count}표</span>
                        <span className="vote-percentage">{percentage}%</span>
                        <button
                          className="quick-join-btn"
                          onClick={() => handleQuickJoin(v)}
                          title="이 항목에 참여하기"
                        >
                          + 참여
                        </button>
                        <button
                          className="vote-item-delete"
                          onClick={() => handleDeleteVoteItem(v)}
                          title="항목 삭제"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      {/* 가격 입력 & 소계 */}
                      <div className="price-row">
                        <label className="price-label">💰</label>
                        <input
                          type="number"
                          className="price-input"
                          placeholder="가격"
                          value={v.price || ""}
                          onChange={(e) => handleUpdatePrice(v, e.target.value)}
                          min="0"
                          step="100"
                        />
                        <span className="price-unit">원</span>
                        {v.price > 0 && (
                          <span className="price-subtotal">
                            × {v.count} = {itemTotal.toLocaleString()}원
                          </span>
                        )}
                      </div>
                      <div className="voters">
                        👥{" "}
                        {v.voters?.map((voter, vIdx) => (
                          <span key={vIdx} className="voter-tag">
                            {voter}
                            <button
                              className="voter-remove"
                              onClick={() => handleRemoveVoter(v, voter)}
                              title={`${voter} 삭제`}
                            >
                              ×
                            </button>
                            {vIdx < v.voters.length - 1 && ", "}
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* 총 금액 */}
              {totalPrice > 0 && (
                <div className="total-price-bar">
                  <span className="total-price-label">🧾 총 예상 금액</span>
                  <span className="total-price-value">
                    {totalPrice.toLocaleString()}원
                  </span>
                </div>
              )}
            </>
          )}
        </section>

        {/* 메뉴 사진 섹션 */}
        <section className="menu-photos">
          <div className="menu-photos-header">
            <h2>📸 메뉴 사진</h2>
            <label className="upload-btn" htmlFor="photo-upload">
              {uploading ? "업로드 중..." : "+ 사진 추가"}
              <input
                id="photo-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploading}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {images.length === 0 ? (
            <div className="empty-photos">
              <p>📷 아직 사진이 없습니다.</p>
              <p>메뉴 사진을 추가해보세요!</p>
            </div>
          ) : (
            <div className="carousel-wrapper">
              {/* 이전 버튼 */}
              <button
                className="carousel-arrow carousel-arrow-left"
                onClick={handlePrev}
                aria-label="이전 사진"
              >
                ‹
              </button>

              {/* 캐러셀 슬라이드 */}
              <div
                className="carousel-track"
                ref={carouselRef}
                onScroll={handleCarouselScroll}
              >
                {images.map((img) => (
                  <div className="carousel-slide" key={img.id}>
                    <img
                      src={img.url}
                      alt={img.fileName || "메뉴 사진"}
                      onClick={() => openModal(img)}
                    />
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteImage(img)}
                      disabled={deleting === img.id}
                      aria-label="사진 삭제"
                    >
                      {deleting === img.id ? "..." : "✕"}
                    </button>
                  </div>
                ))}
              </div>

              {/* 다음 버튼 */}
              <button
                className="carousel-arrow carousel-arrow-right"
                onClick={handleNext}
                aria-label="다음 사진"
              >
                ›
              </button>

              {/* 도트 인디케이터 */}
              <div className="carousel-dots">
                {images.map((_, index) => (
                  <button
                    key={index}
                    className={`carousel-dot ${
                      index === currentSlide ? "active" : ""
                    }`}
                    onClick={() => scrollToSlide(index)}
                    aria-label={`사진 ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 만료 시간 안내 */}
        {remainingTime && !expired && (
          <div
            className={`expiry-footer ${
              expiresAt && expiresAt.getTime() - Date.now() <= 1 * 60 * 60 * 1000
                ? "expiry-danger"
                : expiresAt && expiresAt.getTime() - Date.now() <= 6 * 60 * 60 * 1000
                ? "expiry-warning"
                : ""
            }`}
          >
            ⏰ {remainingTime}
          </div>
        )}

      </div>

      {/* 전체화면 이미지 모달 */}
      {modalImage && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              ✕
            </button>
            <img
              src={modalImage.url}
              alt={modalImage.fileName || "메뉴 사진"}
            />
          </div>
        </div>
      )}

      {/* 빠른 참여 이름 입력 팝업 */}
      {quickJoinTarget && (
        <div
          className="modal-overlay"
          onClick={() => setQuickJoinTarget(null)}
        >
          <div
            className="quick-join-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>"{quickJoinTarget.name}" 참여하기</h3>
            <form onSubmit={handleQuickJoinSubmit}>
              <input
                ref={quickJoinInputRef}
                type="text"
                placeholder="이름을 입력하세요"
                value={quickJoinName}
                onChange={(e) => setQuickJoinName(e.target.value)}
                autoFocus
              />
              <div className="quick-join-popup-actions">
                <button type="submit" className="quick-join-popup-confirm">
                  참여
                </button>
                <button
                  type="button"
                  className="quick-join-popup-cancel"
                  onClick={() => setQuickJoinTarget(null)}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 주문 복사 팝업 */}
      {showCopyPopup && (
        <div
          className="modal-overlay"
          onClick={() => setShowCopyPopup(false)}
        >
          <div
            className="copy-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>📋 주문 요약 복사</h3>
            <button
              className="copy-option-btn"
              onClick={() => handleCopyOrder(false)}
            >
              <span className="copy-option-icon">📝</span>
              <div className="copy-option-text">
                <strong>메뉴만 복사</strong>
                <span className="copy-option-preview">
                  {voteList.slice(0, 2).map((v) => `${v.name} ${v.count}`).join(", ")}
                  {voteList.length > 2 ? " ..." : ""}
                </span>
              </div>
            </button>
            <button
              className="copy-option-btn"
              onClick={() => handleCopyOrder(true)}
            >
              <span className="copy-option-icon">👥</span>
              <div className="copy-option-text">
                <strong>사람 포함 복사</strong>
                <span className="copy-option-preview">
                  {voteList.length > 0
                    ? `${voteList[0].name} ${voteList[0].count} — ${(voteList[0].voters || []).join(", ")} ...`
                    : ""}
                </span>
              </div>
            </button>
            <button
              className="copy-popup-close"
              onClick={() => setShowCopyPopup(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 복사 완료 토스트 */}
      {copyToast && <div className="copy-toast">{copyToast}</div>}

      {/* 새 그룹 생성 팝업 */}
      {showNewGroup && (
        <div
          className="modal-overlay"
          onClick={() => setShowNewGroup(false)}
        >
          <div
            className="quick-join-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>새 그룹 만들기</h3>
            <form onSubmit={handleCreateGroup}>
              <input
                type="text"
                placeholder="그룹 이름 (예: ㅇㅇ팀)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                autoFocus
              />
              <div className="quick-join-popup-actions">
                <button type="submit" className="quick-join-popup-confirm">
                  만들기
                </button>
                <button
                  type="button"
                  className="quick-join-popup-cancel"
                  onClick={() => setShowNewGroup(false)}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
