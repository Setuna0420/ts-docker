"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"

const GAS_URL = "https://script.google.com/macros/s/AKfycbz-LqUv0ys35_1rOx4spWmIiO4LoeD1K_bmVyiDmzZ5T7jEJZqucDHdHd4n1pOjkEEuzg/exec";

// 外部ヘルパー関数：日付データの生成（ゼロ埋めでGASとの完全一致バグを防止）
const generateInitialDays = (offset: number) => {
  const generateDays = [];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const today = new Date();
  const currentDayOfWeek = today.getDay();

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - currentDayOfWeek + i + offset);
    d.setHours(0, 0, 0, 0);

    const month = d.getMonth() + 1;
    const date = d.getDate();

    const mm = String(month).padStart(2, '0');
    const dd = String(date).padStart(2, '0');

    generateDays.push({
      label: `${month}/${date}`,
      dayOfWeek: dayNames[d.getDay()],
      dateObj: d,
      compareFormat: `${d.getFullYear()}/${mm}/${dd}`
    });
  }
  return generateDays;
}

const generateTimes = () => {
  const times = [];
  for (let i = 10; i < 22; i++) {
    times.push({ label: `${i}:00` });
  }
  return times;
};

interface BookedSlot {
  slotId: string;
  userName: string;
  studentId: number;
}

interface DisabledDateObject {
  date: string;
  reason?: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

function ReservationPage() {
  // 状態管理
  const [dayOffset, setDayOffset] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("dayOffset");
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });

  const days = generateInitialDays(dayOffset);
  const [times] = useState(() => generateTimes());

  const today = new Date();
  const todayString = `${today.getMonth() + 1}/${today.getDate()}`;

  // 💡 【修正のキモ1】useStateの初期値関数の中で、今週なら「今日」の曜日インデックスを、先週・来週なら「0（日曜日）」を初期セットする
  const [activeMobileDayIdx, setActiveMobileDayIdx] = useState<number>(() => {
    const initialDays = generateInitialDays(dayOffset);
    const todayIdx = initialDays.findIndex(d => d.label === todayString);
    return todayIdx !== -1 && dayOffset === 0 ? todayIdx : 0;
  });

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [cancelInputId, setCancelInputId] = useState("");
  const [myReservationQuery, setMyReservationQuery] = useState("");

  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [disabledDates, setDisabledDates] = useState<(string | DisabledDateObject)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 💡 【修正のキモ2】ボタンで週が切り替わったときに、スマホの曜日タブも連動して安全に切り替える関数
  const handleWeekChange = (newOffset: number) => {
    setDayOffset(newOffset);
    const nextDays = generateInitialDays(newOffset);
    const todayIdx = nextDays.findIndex(d => d.label === todayString);
    // 新しい週に今日が含まれていれば今日を選択、そうでなければその週の日曜日(0)にする
    setActiveMobileDayIdx(todayIdx !== -1 && newOffset === 0 ? todayIdx : 0);
  };

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // 週の記憶
  useEffect(() => {
    sessionStorage.setItem("dayOffset", dayOffset.toString());
  }, [dayOffset]);

  // データ取得
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(GAS_URL);
      if (!res.ok) throw new Error(`サーバーエラー: ${res.status}`);

      const data = await res.json();
      setBookedSlots(data.bookedSlots || []);
      setDisabledDates(data.disabledDates || []);
    } catch (e) {
      console.warn("予約データの自動更新に一瞬失敗しました:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 定期更新タイマー
  useEffect(() => {
    const timerId = setTimeout(() => { loadData(); }, 0);
    const intervalId = setInterval(() => { loadData(); }, 10000);

    return () => {
      clearTimeout(timerId);
      clearInterval(intervalId);
    };
  }, [loadData]);

  const currentModalBooking = bookedSlots.find(b => b.slotId === selectedSlot);
  const isStudentIdValid = /^[0-9]{7}$/.test(studentId.trim());
  const isFormValid = userName.trim() !== "" && isStudentIdValid;
  const isCancelValid = currentModalBooking && Number(cancelInputId) === currentModalBooking.studentId;

  const getWeekLabel = () => {
    if (dayOffset === 0) return "今週";
    if (dayOffset === 7) return "来週";
    if (dayOffset === -7) return "先週";
    return dayOffset > 0 ? `${dayOffset / 7}週間後の週` : `${Math.abs(dayOffset / 7)}週間前の週`;
  };

  const checkDisabledStatus = (dayCompareFormat: string, timeLabel: string) => {
    const fullDayFormat = dayCompareFormat.trim();
    const timeFormat = `${timeLabel} ${dayCompareFormat}`.replace(/\s+/g, ' ').trim();

    for (const d of disabledDates) {
      if (typeof d === "string") {
        const cleanD = d.replace(/\s+/g, ' ').trim();
        if (cleanD === fullDayFormat || cleanD === timeFormat) {
          return { isDisabled: true, reason: "貸切禁止" };
        }
      } else if (d && typeof d === "object" && d.date) {
        const cleanD = d.date.replace(/\s+/g, ' ').trim();
        if (cleanD === fullDayFormat || cleanD === timeFormat) {
          return { isDisabled: true, reason: d.reason || "貸切禁止" };
        }
      }
    }
    return { isDisabled: false, reason: "" };
  };

  // API通信共通処理
  const sendRequest = async (action: "book" | "cancel", payload: object, successCallback: () => void) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action, slotId: selectedSlot, ...payload }),
      });
      const result = await res.json();

      if (result.success) {
        successCallback();
        setSelectedSlot(null);
        setUserName("");
        setStudentId("");
        setCancelInputId("");
        showToast(action === "book" ? "予約が完了しました！🎉" : "予約をキャンセルしました。");
      } else {
        showToast(action === "book"
          ? (result.error === "Already booked" ? "タッチの差で既に予約されてしまいました。" : "予約に失敗しました。")
          : "処理に失敗しました。既に変更された可能性があります。", "error"
        );
        loadData();
      }
    } catch (e) {
      console.error(`${action}通信エラー:`, e);
      showToast("通信エラーが発生しました。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBook = () => {
    sendRequest("book", { userName, studentId: Number(studentId) }, () => {
      if (selectedSlot) {
        setBookedSlots([...bookedSlots, { slotId: selectedSlot, userName, studentId: Number(studentId) }]);
      }
    });
  };

  const handleCancel = () => {
    sendRequest("cancel", {}, () => {
      setBookedSlots(bookedSlots.filter(b => b.slotId !== selectedSlot));
    });
  };

  const myReservations = bookedSlots
    .filter(b => b.studentId === Number(myReservationQuery.trim()))
    .map(b => {
      const [time, date] = b.slotId.split(" ");
      const [month, dayNum] = date.split("/").map(Number);
      const [hour, min] = time.split(":").map(Number);
      const sortDate = new Date(new Date().getFullYear(), month - 1, dayNum, hour, min);
      return { ...b, time, date, timestamp: sortDate.getTime() };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-4">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full shadow-md"></div>
        <p className="text-sm font-semibold tracking-wider text-zinc-600 animate-pulse">STUDIO DATA LOADING...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 relative font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900 pb-12">

      {/* トースト通知センター */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-4 rounded-2xl shadow-xl border backdrop-blur-md text-sm font-bold pointer-events-auto flex items-center bg-white/90 transition-all duration-300 animate-in slide-in-from-top-4
              ${t.type === "success" ? "border-emerald-100 text-emerald-800 shadow-emerald-100/40" : "border-rose-100 text-rose-700 shadow-rose-100/40"}`}
          >
            <span className="mr-3 text-base">{t.type === "success" ? "✨" : "👀"}</span>
            {t.message}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">

        {/* タイトルエリア */}
        <header className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3 bg-clip-text text-transparent bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600">
            🎵 音スタ 予約システム
          </h1>
          <p className="text-sm font-medium text-zinc-400 tracking-widest uppercase">Original Reservation Dashboard</p>
        </header>

        {/* Bento Grid レイアウト開始 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

          {/* 左サイドバー */}
          <div className="lg:col-span-1 space-y-6">
            {/* カデゴリカード1：週切り替え */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100/80">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">📅 表示期間の変更</h3>
              <div className="flex flex-col gap-2.5">
                <div className="text-center text-sm font-extrabold text-indigo-600 bg-indigo-50/70 py-2 rounded-xl border border-indigo-100/50">
                  {getWeekLabel()}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleWeekChange(dayOffset - 7)} className="bg-zinc-50 hover:bg-zinc-100 active:scale-95 text-zinc-700 border border-zinc-200 font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-sm">← 前の週</button>
                  <button onClick={() => handleWeekChange(dayOffset + 7)} className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-sm">次の週 →</button>
                </div>
              </div>
            </div>

            {/* カテゴリカード2：マイ予約検索 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100/80">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">🔎 自分の予約を検索</h3>
              <input
                type="number"
                placeholder="学籍番号(7桁)を入力"
                value={myReservationQuery}
                onChange={(e) => setMyReservationQuery(e.target.value)}
                className="border border-zinc-200 p-3 rounded-2xl w-full text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50/50 transition-all mb-3"
              />

              {myReservationQuery.trim() && (
                <div className="space-y-2 max-h-55 overflow-y-auto pr-1">
                  {myReservations.length > 0 ? (
                    myReservations.map((res, idx) => (
                      <div key={idx} className="flex flex-col gap-1 text-xs bg-zinc-50 border border-zinc-200/60 p-3 rounded-xl text-zinc-700 hover:border-indigo-200 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-zinc-900">📅 {res.date}</span>
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-extrabold">{res.userName}さん</span>
                        </div>
                        <div className="text-zinc-400 font-medium">{res.time} ～ 利用可能</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-zinc-400 text-center py-4 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">予約が見つかりません</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右メイン：タイムテーブルコンテナ */}
          <div className="lg:col-span-3 space-y-4">

            {/* 📱 スマホ専用：曜日切り替えミニタブ */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden scrollbar-none snap-x">
              {days.map((day, idx) => {
                const isSelected = activeMobileDayIdx === idx;
                const isToday = day.label === todayString && dayOffset === 0;
                return (
                  <button
                    key={day.label}
                    onClick={() => setActiveMobileDayIdx(idx)}
                    className={`snap-center shrink-0 min-w-18 py-2 px-1 rounded-2xl border text-center transition-all duration-200 active:scale-95 ${isSelected
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 font-black"
                      : isToday
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold"
                        : "bg-white border-zinc-200/80 text-zinc-600"
                      }`}
                  >
                    <div className="text-xs">{day.label}</div>
                    <div className={`text-[9px] ${isSelected ? "text-indigo-200" : "text-zinc-400"}`}>({day.dayOfWeek})</div>
                  </button>
                )
              })}
            </div>

            {/* ボードメインカード */}
            <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-zinc-100/80">

              {/* 💻 PC用表示：大画面グリッドタイムテーブル */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-200 pr-1">
                  {/* 曜日ヘッダー */}
                  <div className="grid grid-cols-8 gap-2.5 mb-4 text-center font-bold">
                    <div className="sticky left-0 z-20 bg-white font-medium flex items-center justify-center text-xs py-2 text-zinc-400 tracking-wider uppercase border-b border-zinc-100 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.05)]">TIME</div>
                    {days.map((day) => {
                      const isToday = day.label === todayString && dayOffset === 0;
                      return (
                        <div key={day.label} className={`text-xs md:text-sm py-2 rounded-2xl transition-all border border-transparent ${isToday ? "bg-linear-to-b from-indigo-50 to-indigo-100/50 border-indigo-200 text-indigo-900 shadow-sm" : "text-zinc-600"}`}>
                          <div className="font-black text-sm">{day.label}</div>
                          <div className={`text-[10px] font-bold ${isToday ? "text-indigo-600" : "text-zinc-400"}`}>({day.dayOfWeek})</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 時間ごとの行 */}
                  {times.map((time) => {
                    const startHour = parseInt(time.label);
                    return (
                      <div key={time.label} className="grid grid-cols-8 gap-2.5 mb-2.5 text-center items-center">
                        <div className="sticky left-0 z-10 bg-white text-zinc-500 font-bold flex items-center justify-center h-full text-xs border border-zinc-100 rounded-2xl py-3 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.05)] bg-linear-to-r from-zinc-50 to-white">
                          {startHour}:00
                        </div>

                        {days.map((day) => {
                          const slotId = `${time.label} ${day.label}`;
                          const isWeekend = day.dayOfWeek === "日" || day.dayOfWeek === "土";
                          const isClassTime = time.label >= "10:00" && time.label < "18:00";
                          const bookingData = bookedSlots.find(b => b.slotId === slotId);

                          const universityStatus = checkDisabledStatus(day.compareFormat, time.label);
                          const isSystemDisabled = (!isWeekend && isClassTime) || universityStatus.isDisabled;

                          const slotDate = new Date(day.dateObj);
                          slotDate.setHours(startHour, 0, 0, 0);
                          const isPast = slotDate < today;
                          const isDisabled = isSystemDisabled || isPast;

                          return (
                            <button
                              key={`${time.label}-${day.label}`}
                              className={`rounded-2xl py-3 transition-all font-bold text-xs min-h-15 flex flex-col items-center justify-center border active:scale-[0.97] px-1
                                ${isDisabled
                                  ? "border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed"
                                  : bookingData
                                    ? "border-indigo-100 bg-indigo-50/60 text-indigo-950 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 cursor-pointer shadow-sm shadow-indigo-100/20"
                                    : "border-zinc-200/60 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 hover:-translate-y-0.5 shadow-sm cursor-pointer"}`}
                              disabled={isDisabled}
                              onClick={() => {
                                setUserName(bookingData ? bookingData.userName : "");
                                setStudentId(bookingData ? String(bookingData.studentId) : "");
                                setCancelInputId("");
                                setSelectedSlot(slotId)
                              }}
                            >
                              {universityStatus.isDisabled ? (
                                <span className="text-[10px] text-rose-500 font-extrabold tracking-tight leading-tight line-clamp-2 px-0.5">
                                  {universityStatus.reason}
                                </span>
                              ) : isSystemDisabled ? <span className="text-zinc-300 font-normal text-xs">✕</span>
                                : isPast ? <span className="text-[10px] text-zinc-300 font-normal">終了</span>
                                  : bookingData ? (
                                    <div className="w-full truncate">
                                      <div className="text-xs font-black tracking-tight text-indigo-950">{bookingData.userName}</div>
                                      <div className="text-[9px] text-indigo-400 font-medium tracking-tight mt-0.5">{bookingData.studentId}</div>
                                    </div>
                                  ) : <span className="text-zinc-400 font-medium group-hover:text-zinc-600 text-base">+</span>}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 📱 スマホ専用表示：縦型タイムライン */}
              <div className="md:hidden space-y-2.5">
                {times.map((time) => {
                  const startHour = parseInt(time.label);
                  const day = days[activeMobileDayIdx];
                  const slotId = `${time.label} ${day.label}`;

                  const isWeekend = day.dayOfWeek === "日" || day.dayOfWeek === "土";
                  const isClassTime = time.label >= "10:00" && time.label < "18:00";
                  const bookingData = bookedSlots.find(b => b.slotId === slotId);

                  const universityStatus = checkDisabledStatus(day.compareFormat, time.label);
                  const isSystemDisabled = (!isWeekend && isClassTime) || universityStatus.isDisabled;

                  const slotDate = new Date(day.dateObj);
                  slotDate.setHours(startHour, 0, 0, 0);
                  const isPast = slotDate < today;
                  const isDisabled = isSystemDisabled || isPast;

                  return (
                    <div key={time.label} className="flex items-center gap-3">
                      <div className="w-14 text-center font-black text-sm text-zinc-400">{time.label}</div>

                      <button
                        className={`flex-1 rounded-2xl py-3.5 px-4 text-left transition-all font-bold text-sm min-h-14 border flex items-center justify-between active:scale-[0.98]
                          ${isDisabled
                            ? "border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed"
                            : bookingData
                              ? "border-indigo-100 bg-indigo-50/70 text-indigo-950"
                              : "border-zinc-200 bg-white text-zinc-700 shadow-sm"}`}
                        disabled={isDisabled}
                        onClick={() => {
                          setUserName(bookingData ? bookingData.userName : "");
                          setStudentId(bookingData ? String(bookingData.studentId) : "");
                          setCancelInputId("");
                          setSelectedSlot(slotId)
                        }}
                      >
                        {universityStatus.isDisabled ? (
                          <span className="text-xs text-rose-500 font-black flex items-center gap-1">
                            🚫 <span className="bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">{universityStatus.reason}</span>
                          </span>
                        ) : isSystemDisabled ? <span className="text-zinc-300 font-normal text-xs">✕ 授業時間外など</span>
                          : isPast ? <span className="text-xs text-zinc-300 font-normal">🕒 利用終了</span>
                            : bookingData ? (
                              <div className="flex justify-between items-center w-full">
                                <span className="font-black text-zinc-900">👤 {bookingData.userName} さん</span>
                                <span className="text-[10px] text-indigo-500 bg-white border border-indigo-100 px-2 py-0.5 rounded-lg font-mono">{bookingData.studentId}</span>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center w-full text-zinc-400">
                                <span className="text-xs">🟢 予約可能です</span>
                                <span className="text-base font-medium">+</span>
                              </div>
                            )}
                      </button>
                    </div>
                  )
                })}
              </div>

            </div>
          </div>

        </div>
        {/* Bento Grid レイアウト終了 */}

        {/* モーダルエリア */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-zinc-100/80 transform scale-100 animate-in zoom-in-95 duration-200">

              {currentModalBooking ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-xl mb-4">⚠️</div>
                  <h2 className="text-xl font-black text-zinc-900 mb-1">予約の解除</h2>
                  <p className="text-zinc-400 text-xs mb-4">選択枠：<span className="font-bold text-indigo-600">{selectedSlot}</span></p>

                  <div className="mb-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200/60 text-center">
                    <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">現在の予約代表者</span>
                    <span className="text-base font-black text-zinc-800">{userName} さん</span>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-bold text-zinc-500 mb-1.5 pl-1 text-left">本人確認のため学籍番号(7桁)を入力</label>
                    <input
                      type="number"
                      placeholder="学籍番号を入力"
                      value={cancelInputId}
                      onChange={(e) => setCancelInputId(e.target.value)}
                      className="border border-zinc-200 p-3 rounded-2xl w-full text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 bg-zinc-50"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={!isCancelValid || isSubmitting}
                      className={`w-full text-white font-bold py-3 rounded-2xl text-sm transition-all shadow-md active:scale-95
                        ${isCancelValid && !isSubmitting ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" : "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"}`}
                    >
                      {isSubmitting ? "キャンセルデータを送信中..." : "この予約を取り消す"}
                    </button>
                    <button onClick={() => setSelectedSlot(null)} disabled={isSubmitting} className="w-full bg-white hover:bg-zinc-50 text-zinc-500 border border-zinc-200 font-bold py-3 rounded-2xl text-sm transition-colors">閉じる</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl mb-4">📝</div>
                  <h2 className="text-xl font-black text-zinc-900 mb-1">スタジオ予約の登録</h2>
                  <p className="text-zinc-400 text-xs mb-5">選択枠：<span className="font-bold text-indigo-600">{selectedSlot}</span></p>

                  <div className="space-y-4 text-left mb-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 mb-1.5 pl-1">利用代表者名</label>
                      <input type="text" placeholder="名前を入力" value={userName} disabled={isSubmitting} onChange={(e) => setUserName(e.target.value)} className="border border-zinc-200 p-3 rounded-2xl w-full text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 mb-1.5 pl-1">
                        学籍番号 <span className={`text-[10px] font-bold ${isStudentIdValid ? "text-emerald-600" : "text-zinc-400"}`}>(7桁の数字)</span>
                      </label>
                      <input type="number" placeholder="7桁の数字を入力" value={studentId} disabled={isSubmitting} onChange={(e) => setStudentId(e.target.value)} className="border border-zinc-200 p-3 rounded-2xl w-full text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button onClick={handleBook} disabled={!isFormValid || isSubmitting} className={`w-full font-bold py-3 rounded-2xl transition-all shadow-md text-sm active:scale-95 ${isFormValid && !isSubmitting ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200" : "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"}`}>
                      {isSubmitting ? "予約データを書き込み中..." : "この内容で予約を確定する"}
                    </button>
                    <button onClick={() => { setSelectedSlot(null); setUserName(""); setStudentId(""); }} disabled={isSubmitting} className="w-full bg-white hover:bg-gray-50 text-zinc-500 border border-zinc-200 font-bold py-3 rounded-2xl text-sm transition-colors">キャンセル</button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default dynamic(() => Promise.resolve(ReservationPage), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-400 font-semibold tracking-wider">
      INITIALIZING DASHBOARD...
    </div>
  )
})