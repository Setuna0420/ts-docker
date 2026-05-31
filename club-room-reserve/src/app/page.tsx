"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"

// =============================================================================
// 1. 定数・外部設定
// =============================================================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbz-LqUv0ys35_1rOx4spWmIiO4LoeD1K_bmVyiDmzZ5T7jEJZqucDHdHd4n1pOjkEEuzg/exec";

// =============================================================================
// 2. 型定義 (TypeScriptインターフェース)
// =============================================================================
interface BookedSlot {
  slotId: string;    // 例: "10:00 2026/05/24"
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

// =============================================================================
// 3. 日付・時間生成ヘルパー
// =============================================================================
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

const getSlotTimestamp = (slotId: string) => {
  const [time, dateStr] = slotId.split(" ");
  const [year, month, day] = dateStr.split("/").map(Number);
  const [hour] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, 0).getTime();
};

// =============================================================================
// 4. メインコンポーネント
// =============================================================================
function ReservationPage() {

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

  const [activeMobileDayIdx, setActiveMobileDayIdx] = useState<number>(() => {
    const initialDays = generateInitialDays(dayOffset);
    const todayIdx = initialDays.findIndex(d => d.label === todayString);
    return todayIdx !== -1 && dayOffset === 0 ? todayIdx : 0;
  });

  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [cancelTargetSlot, setCancelTargetSlot] = useState<string | null>(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  const [userName, setUserName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [cancelInputId, setCancelInputId] = useState("");
  const [myReservationQuery, setMyReservationQuery] = useState("");

  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [disabledDates, setDisabledDates] = useState<(string | DisabledDateObject)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const handleWeekChange = (newOffset: number) => {
    setDayOffset(newOffset);
    setActiveMobileDayIdx(0);
    setSelectedSlots([]);
  };

  const handleSlotClick = (slotId: string) => {
    if (selectedSlots.includes(slotId)) {
      setSelectedSlots(selectedSlots.filter(id => id !== slotId));
      return;
    }

    if (selectedSlots.length === 0) {
      setSelectedSlots([slotId]);
    } else if (selectedSlots.length === 1) {
      const firstTouchTime = getSlotTimestamp(selectedSlots[0]);
      const currentTouchTime = getSlotTimestamp(slotId);
      const isContinuous = Math.abs(firstTouchTime - currentTouchTime) === 3600000;

      if (isContinuous) {
        setSelectedSlots([...selectedSlots, slotId]);
      } else {
        setSelectedSlots([slotId]);
      }
    } else {
      setSelectedSlots([slotId]);
    }
  };

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("dayOffset", dayOffset.toString());
  }, [dayOffset]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(GAS_URL);
      if (!res.ok) throw new Error(`サーバーエラー: ${res.status}`);
      const data = await res.json();
      setBookedSlots(data.bookedSlots || []);
      setDisabledDates(data.disabledDates || []);
    } catch (e) {
      console.warn("データ同期失敗:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = setTimeout(() => { loadData(); }, 0);
    const intervalId = setInterval(() => { loadData(); }, 10000);
    return () => {
      clearTimeout(timerId);
      clearInterval(intervalId);
    };
  }, [loadData]);

  const currentCancelBooking = bookedSlots.find(b => b.slotId === cancelTargetSlot);
  const isStudentIdValid = /^[0-9]{7}$/.test(studentId.trim());
  const isNameValid = userName.trim().length > 0 && userName.trim().length <= 10;
  const isFormValid = isNameValid && isStudentIdValid;
  const isCancelValid = currentCancelBooking && Number(cancelInputId) === currentCancelBooking.studentId;

  const getWeekLabel = () => {
    if (dayOffset === 0) return "今週";
    if (dayOffset === 7) return "来週";
    if (dayOffset === -7) return "先週";
    return dayOffset > 0 ? `${dayOffset / 7}週間後` : `${Math.abs(dayOffset / 7)}週間前`;
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

  const handleBookSubmit = async () => {
    if (isSubmitting || selectedSlots.length === 0) return;
    setIsSubmitting(true);

    let hasError = false;
    const newBookings: BookedSlot[] = [];

    for (const slotId of selectedSlots) {
      try {
        const res = await fetch(GAS_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "book",
            slotId,
            userName: userName.trim(),
            studentId: Number(studentId)
          }),
        });
        const result = await res.json();
        if (result.success) {
          newBookings.push({ slotId, userName: userName.trim(), studentId: Number(studentId) });
        } else {
          hasError = true;
        }
      } catch (e) {
        hasError = true;
      }
    }

    if (!hasError) {
      setBookedSlots(prev => [...prev, ...newBookings]);
      showToast("すべての予約が完了しました");
      setSelectedSlots([]);
      setIsBookModalOpen(false);
      setUserName("");
      setStudentId("");
    } else {
      showToast("一部またはすべての枠が、タッチの差で埋まった可能性があります", "error");
      loadData();
    }
    setIsSubmitting(false);
  };

  const handleCancelSubmit = async () => {
    if (isSubmitting || !cancelTargetSlot) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: "cancel", slotId: cancelTargetSlot }),
      });
      const result = await res.json();

      if (result.success) {
        setBookedSlots(prev => prev.filter(b => b.slotId !== cancelTargetSlot));
        setCancelTargetSlot(null);
        setCancelInputId("");
        showToast("予約をキャンセルしました");
      } else {
        showToast("処理に失敗しました", "error");
        loadData();
      }
    } catch (e) {
      showToast("通信エラーが発生しました", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const myReservations = bookedSlots
    .filter(b => b.studentId === Number(myReservationQuery.trim()))
    .map(b => {
      const [time, dateStr] = b.slotId.split(" ");
      const [year, month, dayNum] = dateStr.split("/").map(Number);
      const [hour] = time.split(":").map(Number);
      const sortDate = new Date(year, month - 1, dayNum, hour, 0);
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const dayOfWeekStr = dayNames[sortDate.getDay()];

      return {
        ...b,
        time,
        date: `${month}/${dayNum}`,
        dayOfWeek: dayOfWeekStr,
        timestamp: sortDate.getTime()
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const getSortedSelectedLabels = () => {
    return [...selectedSlots]
      .sort((a, b) => getSlotTimestamp(a) - getSlotTimestamp(b))
      .map(id => {
        const [timePart, datePart] = id.split(" ");
        const [, month, day] = datePart.split("/");
        return `${parseInt(month, 10)}/${parseInt(day, 10)} ${timePart}`;
      })
      .join(", ");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 gap-4">
        <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full shadow-lg shadow-cyan-950"></div>
        <p className="text-xs font-black tracking-widest text-slate-500">SYNCHRONIZING ROCK DATABASE...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-300 overscroll-behavior-y-none pb-24 md:pb-12">

      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md text-xs font-black tracking-wider pointer-events-auto flex items-center bg-slate-900/95 transition-all duration-300 animate-in slide-in-from-top-4
              ${t.type === "success" ? "border-emerald-500/30 text-emerald-400 shadow-emerald-950" : "border-rose-500/30 text-rose-400 shadow-rose-950"}`}
          >
            <span className="mr-2.5 text-sm">{t.type === "success" ? "✓" : "!"}</span>
            {t.message}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">

        <header className="text-center mb-6 md:mb-12 pt-4">
          <div className="flex items-center justify-center gap-2.5 mb-1">
            <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 11h-6V3l-7 9h6v7l7-9z" /></svg>
            <h1 className="text-2xl md:text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400">
              音スタ 予約システム
            </h1>
          </div>
          <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Band Practice Control Panel</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

          {/* 左サイドバー */}
          <div className="lg:col-span-1 space-y-6">
            <div className="hidden md:block bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                表示期間の変更
              </h3>
              <div className="flex flex-col gap-2.5">
                <div className="text-center text-xs font-black text-cyan-400 bg-slate-950 py-2.5 rounded-xl border border-slate-800">
                  {getWeekLabel()}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleWeekChange(dayOffset - 7)} className="bg-slate-800 text-slate-200 font-black py-2.5 px-3 rounded-xl text-xs border border-slate-700 active:scale-95 transition-all shadow-md cursor-pointer">← 前の週</button>
                  <button onClick={() => handleWeekChange(dayOffset + 7)} className="bg-indigo-600 text-white font-black py-2.5 px-3 rounded-xl text-xs active:scale-95 transition-all shadow-md cursor-pointer">次の週 →</button>
                </div>
              </div>
            </div>

            {/* 自分の予約検索窓 */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                自分の予約を検索
              </h3>
              <input
                type="number"
                placeholder="学籍番号(7桁)を入力"
                value={myReservationQuery}
                onChange={(e) => setMyReservationQuery(e.target.value)}
                className="border border-slate-800 p-3 rounded-2xl w-full text-base md:text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-950 text-slate-100 transition-all mb-3 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />

              {myReservationQuery.trim() && (
                <div className="space-y-2 max-h-55 overflow-y-auto pr-1">
                  {myReservations.length > 0 ? (
                    myReservations.map((res, idx) => (
                      <div key={idx} className="flex flex-col gap-1 text-[11px] bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-300">
                        <div className="flex justify-between items-center gap-2">
                          {/* ★バグ修正：カレンダーとカラーのターゲットを統一（日付の文字自体に色付け） */}
                          <span className={`font-black shrink-0 ${res.dayOfWeek === "土" ? "text-blue-400" : res.dayOfWeek === "日" ? "text-rose-400" : "text-slate-100"}`}>
                            📅 {res.date}
                            <span className="ml-1 text-[10px] font-black text-slate-500">
                              ({res.dayOfWeek})
                            </span>
                          </span>
                          <span className="text-[9px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded-full font-black truncate max-w-24">
                            {res.userName}さん
                          </span>
                        </div>
                        <div className="text-slate-500 font-bold font-mono">{res.time} 〜</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-slate-600 text-center py-4 bg-slate-950 rounded-xl border border-dashed border-slate-800">予約データがありません</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右メイン：タイムテーブル */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-slate-900 rounded-3xl p-4 md:p-6 border border-slate-800 shadow-xl">

              {/* 💻 PC用レイアウト */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-200 pr-1">
                  <div className="grid grid-cols-8 gap-2.5 mb-4 text-center font-bold">
                    <div className="sticky left-0 z-20 bg-slate-900 font-black flex items-center justify-center text-[10px] py-2 text-slate-500 tracking-wider border-b border-slate-800">TIME</div>
                    {days.map((day) => {
                      const isToday = day.label === todayString && dayOffset === 0;
                      return (
                        <div key={day.label} className={`text-xs py-2 rounded-2xl border ${isToday ? "bg-gradient-to-b from-indigo-950 to-slate-900 border-indigo-500/40 text-indigo-200" : "border-transparent bg-slate-950/40"}`}>
                          <div className={`font-black text-sm ${day.dayOfWeek === "土" ? "text-blue-400" : day.dayOfWeek === "日" ? "text-rose-400" : "text-slate-200"}`}>{day.label}</div>
                          <div className={`text-[9px] font-black mt-0.5 ${isToday ? "text-cyan-400" : "text-slate-600"}`}>({day.dayOfWeek})</div>
                        </div>
                      )
                    })}
                  </div>

                  {times.map((time) => {
                    const startHour = parseInt(time.label);
                    return (
                      <div key={time.label} className="grid grid-cols-8 gap-2.5 mb-2.5 text-center items-center">
                        <div className="sticky left-0 z-10 text-slate-400 font-black flex items-center justify-center h-full text-xs border border-slate-800 rounded-2xl py-3 bg-gradient-to-r from-slate-950 to-slate-900 font-mono">
                          {startHour}:00
                        </div>

                        {days.map((day) => {
                          const slotId = `${time.label} ${day.compareFormat}`;
                          const isWeekend = day.dayOfWeek === "日" || day.dayOfWeek === "土";
                          const isClassTime = time.label >= "10:00" && time.label < "18:00";
                          const bookingData = bookedSlots.find(b => b.slotId === slotId);

                          const universityStatus = checkDisabledStatus(day.compareFormat, time.label);
                          const isSystemDisabled = (!isWeekend && isClassTime) || universityStatus.isDisabled;

                          const slotDate = new Date(day.dateObj);
                          slotDate.setHours(startHour, 0, 0, 0);
                          const isPast = slotDate < today;
                          const isDisabled = isSystemDisabled || isPast;

                          const isSelected = selectedSlots.includes(slotId);

                          return (
                            <button
                              key={`${time.label}-${day.label}`}
                              className={`rounded-2xl py-3 transition-all font-black text-xs min-h-15 flex flex-col items-center justify-center border active:scale-[0.97] px-1 duration-100 cursor-pointer
                                ${isDisabled
                                  ? "border-slate-950 bg-slate-950/30 text-slate-800 cursor-not-allowed"
                                  : bookingData
                                    ? "border-indigo-500/20 bg-indigo-950/30 text-indigo-200 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-500/40"
                                    : isSelected
                                      ? "border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-lg shadow-cyan-950/50 scale-[0.98]"
                                      : "border-slate-800/80 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:border-cyan-500"}`}
                              disabled={isDisabled}
                              onClick={() => {
                                if (bookingData) {
                                  setCancelTargetSlot(slotId);
                                  setUserName(bookingData.userName);
                                  setCancelInputId("");
                                } else {
                                  handleSlotClick(slotId);
                                }
                              }}
                            >
                              {universityStatus.isDisabled ? (
                                <span className="text-[9px] text-rose-400 font-black tracking-tight leading-tight line-clamp-2 px-0.5">{universityStatus.reason}</span>
                              ) : isSystemDisabled ? <span className="text-slate-800 font-normal text-xs">✕</span>
                                : isPast ? <span className="text-[10px] text-slate-800 font-medium">終了</span>
                                  : bookingData ? (
                                    <div className="w-full truncate px-0.5">
                                      <div className="text-xs font-black tracking-tight text-indigo-300 truncate">{bookingData.userName}</div>
                                      <div className="text-[9px] text-slate-500 font-mono mt-0.5 font-bold">{bookingData.studentId}</div>
                                    </div>
                                  ) : isSelected ? (
                                    <span className="text-cyan-300 font-black text-xs animate-pulse">✓ 選択中</span>
                                  ) : <span className="text-slate-700 font-black text-sm">+</span>}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 📱 スマホ用レイアウト */}
              <div className="md:hidden space-y-3">
                <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 pb-3 mb-1 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">SELECTED DATE</span>
                    <span className={`text-base font-black ${days[activeMobileDayIdx].dayOfWeek === "土" ? "text-blue-400" : days[activeMobileDayIdx].dayOfWeek === "日" ? "text-rose-400" : "text-cyan-400"}`}>
                      📅 {days[activeMobileDayIdx].label} ({days[activeMobileDayIdx].dayOfWeek})
                    </span>
                  </div>
                  <span className="text-[11px] font-black bg-slate-950 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-800">
                    {getWeekLabel()}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-0.5">
                  {times.map((time) => {
                    const startHour = parseInt(time.label);
                    const day = days[activeMobileDayIdx];
                    const slotId = `${time.label} ${day.compareFormat}`;

                    const bookingData = bookedSlots.find(b => b.slotId === slotId);
                    const universityStatus = checkDisabledStatus(day.compareFormat, time.label);
                    const isSystemDisabled = (!(day.dayOfWeek === "日" || day.dayOfWeek === "土") && time.label >= "10:00" && time.label < "18:00") || universityStatus.isDisabled;

                    const slotDate = new Date(day.dateObj);
                    slotDate.setHours(startHour, 0, 0, 0);
                    const isPast = slotDate < today;
                    const isDisabled = isSystemDisabled || isPast;

                    const isSelected = selectedSlots.includes(slotId);

                    return (
                      <div key={time.label} className="flex items-center gap-3">
                        <div className="w-12 text-center font-black text-xs text-slate-500 font-mono">{time.label}</div>
                        <button
                          className={`flex-1 rounded-2xl py-3.5 px-4 text-left transition-all font-bold text-sm min-h-14 border flex items-center justify-between active:scale-[0.98] duration-100 cursor-pointer
                            ${isDisabled
                              ? "border-slate-950 bg-slate-950/30 text-slate-700 cursor-not-allowed"
                              : bookingData
                                ? "border-indigo-500/20 bg-indigo-950/20 text-indigo-200"
                                : isSelected
                                  ? "border-cyan-400 bg-cyan-950/40 text-cyan-300"
                                  : "border-slate-800/80 bg-slate-950 text-slate-400"}`}
                          disabled={isDisabled}
                          onClick={() => {
                            if (bookingData) {
                              setCancelTargetSlot(slotId);
                              setUserName(bookingData.userName);
                              setCancelInputId("");
                            } else {
                              handleSlotClick(slotId);
                            }
                          }}
                        >
                          {universityStatus.isDisabled ? (
                            <span className="text-[11px] text-rose-400 font-black flex items-center gap-1">✕ <span className="bg-rose-950/30 border border-rose-900/20 px-2 py-0.5 rounded-lg text-[10px]">{universityStatus.reason}</span></span>
                          ) : isSystemDisabled ? <span className="text-slate-700 font-normal text-[11px]">✕ 授業のため貸切</span>
                            : isPast ? <span className="text-[11px] text-slate-700 font-normal">🕒 利用不可（終了）</span>
                              : bookingData ? (
                                <div className="flex justify-between items-center w-full min-w-0 gap-2">
                                  <span className="font-black text-slate-200 truncate flex-1">👤 {bookingData.userName}</span>
                                  <span className="text-[10px] text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md font-mono font-bold shrink-0">{bookingData.studentId}</span>
                                </div>
                              ) : isSelected ? (
                                <div className="flex justify-between items-center w-full text-cyan-400 font-black">
                                  <span>✓ 連続選択中（最大2コマ）</span>
                                  <span className="text-xs bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-lg">確保</span>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center w-full text-slate-600">
                                  <span className="text-[11px] font-bold">🟢 空きコマ（予約可能）</span>
                                  <span className="text-sm font-black">+</span>
                                </div>
                              )}
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-slate-800 pt-3 mt-2 bg-slate-950/40 p-3 rounded-2xl">
                  <div className="flex gap-1.5 overflow-x-auto pb-2.5 scrollbar-none snap-x">
                    {days.map((day, idx) => {
                      // ここで正しく定数を定義します
                      const isSelectedDay = activeMobileDayIdx === idx;
                      const isToday = day.label === todayString && dayOffset === 0;
                      return (
                        <button
                          key={day.label}
                          onClick={() => setActiveMobileDayIdx(idx)}
                          className={`snap-center shrink-0 min-w-[66px] py-2 px-1 rounded-xl border text-center transition-all duration-100 active:scale-95 cursor-pointer 
        ${isSelectedDay
                              ? "bg-indigo-600 border-indigo-600 text-white font-black shadow-lg shadow-indigo-950"
                              : isToday
                                ? "bg-slate-900 border-indigo-500/40 text-indigo-300 font-bold"
                                : "bg-slate-900/40 border-slate-800/80 text-slate-500"}`}
                        >
                          <div className={`text-xs font-black ${isSelectedDay ? "text-white" : day.dayOfWeek === "土" ? "text-blue-400" : day.dayOfWeek === "日" ? "text-rose-400" : "text-slate-400"}`}>{day.label}</div>
                          <div className={`text-[9px] font-bold ${isSelectedDay ? "text-indigo-200" : "text-slate-600"}`}>({day.dayOfWeek})</div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mt-1">
                    <button onClick={() => handleWeekChange(dayOffset - 7)} className="bg-slate-900 text-slate-400 border border-slate-800 font-black py-2.5 px-3 rounded-xl text-xs active:scale-95 cursor-pointer">← 前の週</button>
                    <button onClick={() => handleWeekChange(dayOffset + 7)} className="bg-slate-900 text-slate-400 border border-slate-800 font-black py-2.5 px-3 rounded-xl text-xs active:scale-95 cursor-pointer">次の週 →</button>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* 画面下部の一括予約トリガーパネル */}
        {selectedSlots.length > 0 && (
          <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:max-w-sm z-40 bg-gradient-to-r from-cyan-950 to-slate-900 border-2 border-cyan-500/40 p-4 rounded-3xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-8 duration-200 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black text-cyan-400 tracking-wider uppercase">BULK RESERVATION MODE</p>
                <p className="text-xs font-bold text-slate-300 mt-0.5 truncate font-mono">{getSortedSelectedLabels()}</p>
              </div>
              <span className="text-xs font-black bg-cyan-500 text-slate-950 px-2.5 py-1 rounded-xl shadow-md font-mono shrink-0 ml-2">
                {selectedSlots.length}/2 コマ
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setSelectedSlots([])} className="bg-slate-950 hover:bg-slate-800 text-slate-400 font-black text-[11px] py-2.5 rounded-xl border border-slate-800 active:scale-95 cursor-pointer">クリア</button>
              <button onClick={() => setIsBookModalOpen(true)} className="col-span-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs py-2.5 rounded-xl active:scale-95 shadow-lg shadow-cyan-950/40 cursor-pointer flex items-center justify-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                予約手続きへ
              </button>
            </div>
          </div>
        )}

        {/* 一括予約登録モーダル */}
        {isBookModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
            <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-800 transform scale-100 animate-in zoom-in-95 duration-100">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/50 text-cyan-400 border border-cyan-800/20 flex items-center justify-center text-sm font-black mb-4">＋</div>
              <h2 className="text-xl font-black text-slate-100 mb-1">スタジオ一括予約の登録</h2>
              <p className="text-slate-400 text-xs mb-4">選択中の枠：<span className="font-bold text-cyan-400 font-mono">{getSortedSelectedLabels()}</span></p>

              <div className="space-y-4 text-left mb-6">
                <div>
                  <div className="flex justify-between items-center mb-1.5 pl-1">
                    <label className="block text-[11px] font-black text-slate-400">利用代表者名</label>
                    <span className={`text-[10px] font-black ${userName.trim().length > 10 ? "text-rose-400 animate-pulse" : "text-slate-600"}`}>
                      {userName.trim().length}/10文字
                    </span>
                  </div>
                  {/* ★バグ修正：inputMode="text" を追加して、直前に数字を選んでいても確実に日本語キーボードを開かせる */}
                  <input
                    type="text"
                    inputMode="text"
                    maxLength={12}
                    placeholder="名前を入力 (10文字以内)"
                    value={userName}
                    disabled={isSubmitting}
                    onChange={(e) => setUserName(e.target.value)}
                    className="border border-slate-800 p-3 rounded-2xl w-full text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-950 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 mb-1.5 pl-1">学籍番号 <span className={`text-[10px] font-black ${isStudentIdValid ? "text-emerald-400" : "text-slate-600"}`}>(7桁の数字)</span></label>
                  <input type="number" placeholder="7桁の数字を入力" value={studentId} disabled={isSubmitting} onChange={(e) => setStudentId(e.target.value)} className="border border-slate-800 p-3 rounded-2xl w-full text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-950 text-slate-100 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleBookSubmit}
                  disabled={!isFormValid || isSubmitting}
                  className={`w-full font-black py-3 rounded-2xl transition-all shadow-md text-xs tracking-wider active:scale-95 duration-100 cursor-pointer flex items-center justify-center gap-2 
                    ${isFormValid && !isSubmitting ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950" : "bg-slate-800 text-slate-600 border border-slate-800/50 cursor-not-allowed shadow-none"}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.01M9 22h6a2 2 0 002-2V4a2 2 0 00-2-2H9a2 2 0 00-2 2v16a2 2 0 002 2zM7 8h10M7 12h10M7 16h10" />
                  </svg>
                  {isSubmitting ? "連続書き込み中..." : "まとめて予約を確定する"}
                </button>
                <button onClick={() => setIsBookModalOpen(false)} disabled={isSubmitting} className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 font-black py-3 rounded-2xl text-xs transition-colors cursor-pointer">戻る</button>
              </div>
            </div>
          </div>
        )}

        {/* 予約の解除用モーダル */}
        {cancelTargetSlot && currentCancelBooking && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
            <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-800 transform scale-100 animate-in zoom-in-95 duration-100">
              <div className="w-10 h-10 rounded-xl bg-rose-950/50 text-rose-400 border border-rose-800/20 flex items-center justify-center text-sm font-black mb-4">✕</div>
              <h2 className="text-xl font-black text-slate-100 mb-1">予約の解除</h2>
              <p className="text-slate-400 text-xs mb-4">選択枠：<span className="font-bold text-cyan-400 font-mono">{cancelTargetSlot.split(" ")[0]} ({cancelTargetSlot.split(" ")[1].split("/")[1]}/{cancelTargetSlot.split(" ")[1].split("/")[2]})</span></p>

              <div className="mb-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center shadow-inner">
                <span className="block text-[9px] font-black text-slate-600 tracking-wider mb-1">現在の予約代表者</span>
                <span className="text-sm font-black text-slate-300 truncate block px-2">{userName} さん</span>
              </div>

              <div className="mb-6">
                <label className="block text-[11px] font-black text-slate-400 mb-1.5 pl-1 text-left">本人確認のため学籍番号(7桁)を入力</label>
                <input
                  type="number"
                  placeholder="学籍番号を入力"
                  value={cancelInputId}
                  onChange={(e) => setCancelInputId(e.target.value)}
                  className="border border-slate-800 p-3 rounded-2xl w-full text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-950 text-slate-100 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleCancelSubmit}
                  disabled={!isCancelValid || isSubmitting}
                  className={`w-full text-white font-black py-3 rounded-2xl text-xs tracking-wider transition-all shadow-md active:scale-95 duration-100 cursor-pointer flex items-center justify-center gap-2
                    ${isCancelValid && !isSubmitting ? "bg-rose-600 hover:bg-rose-500 shadow-rose-950" : "bg-slate-800 text-slate-500 border border-slate-800/50 cursor-not-allowed shadow-none"}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {isSubmitting ? "処理中..." : "この予約を取り消す"}
                </button>
                <button onClick={() => setCancelTargetSlot(null)} disabled={isSubmitting} className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 font-black py-3 rounded-2xl text-xs transition-colors cursor-pointer">閉じる</button>
              </div>
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-600 font-black tracking-widest text-xs">
      INITIALIZING ROCK DASHBOARD...
    </div>
  )
})