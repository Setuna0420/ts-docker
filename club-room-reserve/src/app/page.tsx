"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"

import { Toast, ToastType } from "./components/Toast"
import { Modals } from "./components/Modals"

// =============================================================================
// 1. 定数・外部設定
// =============================================================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbz-LqUv0ys35_1rOx4spWmIiO4LoeD1K_bmVyiDmzZ5T7jEJZqucDHdHd4n1pOjkEEuzg/exec";

interface BookedSlot {
  slotId: string;
  userName: string;
  studentId: number;
}

interface DisabledDateObject {
  date: string;
  reason?: string;
}

// =============================================================================
// 2. 日付・時間生成ヘルパー
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
// 3. メインコンポーネント
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
  const [myReservationQuery, setMyReservationQuery] = useState("");

  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [disabledDates, setDisabledDates] = useState<(string | DisabledDateObject)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [toasts, setToasts] = useState<ToastType[]>([]);

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

  const isSelectedSlotsContinuous = () => {
    if (selectedSlots.length <= 1) return true;
    if (selectedSlots.length === 2) {
      const t1 = getSlotTimestamp(selectedSlots[0]);
      const t2 = getSlotTimestamp(selectedSlots[1]);
      return Math.abs(t1 - t2) === 3600000;
    }
    return false;
  };

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
    if (isSubmitting || selectedSlots.length === 0 || !isSelectedSlotsContinuous()) return;
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
    if (isSubmittingCancel || !cancelTargetSlot) return;

    const confirmDelete = window.confirm("本当にこの予約をキャンセルしてもよろしいですか？\n※この操作は取り消せません。");
    if (!confirmDelete) return;

    setIsSubmittingCancel(true);
    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: "cancel", slotId: cancelTargetSlot }),
      });
      const result = await res.json();

      if (result.success) {
        setBookedSlots(prev => prev.filter(b => b.slotId !== cancelTargetSlot));
        setCancelTargetSlot(null);
        showToast("予約をキャンセルしました");
      } else {
        showToast("処理に失敗しました", "error");
        loadData();
      }
    } catch (e) {
      showToast("通信エラーが発生しました", "error");
    } finally {
      setIsSubmittingCancel(false);
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

      <Toast toasts={toasts} />

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
                    myReservations.map((res, idx) => {
                      // 💡 【仕様変更：過去枠のキャンセル禁止】
                      // 検索でヒットしたコマが「過去」のものかどうかを判定
                      const isPastRes = res.timestamp < today.getTime();

                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 text-[11px] bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-300 hover:border-slate-700 transition-colors">
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {/* 💡 紛らわしい「📅」を排除し、シンプルなテキストのみに変更 */}
                              <span className={`font-black shrink-0 ${res.dayOfWeek === "土" ? "text-blue-400" : res.dayOfWeek === "日" ? "text-rose-400" : "text-slate-100"}`}>
                                {res.date}
                                <span className="ml-1 text-[10px] font-black text-slate-500">({res.dayOfWeek})</span>
                              </span>
                              <span className="text-[9px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded-full font-black truncate max-w-20">
                                {res.userName}さん
                              </span>
                            </div>
                            <div className="text-slate-500 font-bold font-mono">{res.time} 〜 {isPastRes && <span className="text-[9px] text-slate-700 font-sans font-normal ml-1">(終了)</span>}</div>
                          </div>

                          {/* 💡 過去の枠なら✕ボタンを出さず、未来の枠の時だけ消せるようにガードを設置 */}
                          {!isPastRes ? (
                            <button
                              onClick={() => setCancelTargetSlot(res.slotId)}
                              className="w-7 h-7 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/30 rounded-lg font-black text-xs flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0"
                              title="この枠をキャンセル"
                            >
                              ✕
                            </button>
                          ) : (
                            <span className="w-7 h-7 flex items-center justify-center text-[10px] text-slate-800 font-bold">✔</span>
                          )}
                        </div>
                      )
                    })
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
                          const isUniversityDisabled = universityStatus.isDisabled;
                          const isSystemDisabled = (!isWeekend && isClassTime) || isUniversityDisabled;

                          const slotDate = new Date(day.dateObj);
                          slotDate.setHours(startHour, 0, 0, 0);
                          const isPast = slotDate < today;

                          const isDisabled = (isSystemDisabled && !bookingData) || (isPast && !bookingData);
                          const isSelected = selectedSlots.includes(slotId);

                          const stripeClass = isSystemDisabled
                            ? "bg-[linear-gradient(135deg,#020617_25%,#0f172a_25%,#0f172a_50%,#020617_50%,#020617_75%,#0f172a_75%,#0f172a_100%)] bg-[length:16px_16px] opacity-40 border-slate-950/50"
                            : "";

                          return (
                            <button
                              key={`${time.label}-${day.label}`}
                              className={`rounded-2xl py-3 transition-all font-black text-xs min-h-15 flex flex-col items-center justify-center border active:scale-[0.97] px-1 duration-100
                                ${stripeClass}
                                ${isDisabled
                                  ? "border-slate-950 bg-slate-950/30 text-slate-800 cursor-not-allowed"
                                  : bookingData
                                    ? isPast
                                      ? "border-slate-800/60 bg-slate-900/40 text-slate-600 cursor-not-allowed"
                                      : "border-indigo-500/20 bg-indigo-950/30 text-indigo-200 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-500/40 cursor-pointer"
                                    : isSelected
                                      ? "border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-lg shadow-cyan-950/50 scale-[0.98] cursor-pointer"
                                      : "border-slate-800/80 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:border-cyan-500 cursor-pointer"}`}
                              disabled={isDisabled || (isPast && !!bookingData)}
                              onClick={() => {
                                if (bookingData) {
                                  setCancelTargetSlot(slotId);
                                } else {
                                  handleSlotClick(slotId);
                                }
                              }}
                            >
                              {universityStatus.isDisabled ? (
                                <span className="text-[9px] text-rose-500 font-bold tracking-tight leading-tight line-clamp-2 px-0.5">{universityStatus.reason}</span>
                              ) : isSystemDisabled ? <span className="text-slate-700 font-normal text-xs">✕ 授業</span>
                                : bookingData ? (
                                  <div className="w-full truncate px-0.5">
                                    <div className={`text-xs font-black tracking-tight truncate ${isPast ? "text-slate-600 line-through" : "text-indigo-300"}`}>{bookingData.userName}</div>
                                    <div className={`text-[9px] font-mono mt-0.5 font-bold ${isPast ? "text-slate-700" : "text-slate-500"}`}>{bookingData.studentId}</div>
                                  </div>
                                ) : isPast ? <span className="text-[10px] text-slate-800 font-medium">終了</span>
                                  : isSelected ? (
                                    <span className="text-cyan-300 font-black text-xs animate-pulse">✓ 選択</span>
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
                    {/* 💡 紛らわしいカレンダーの絵文字を排除し、超スッキリした文字盤に変更 */}
                    <span className={`text-base font-black ${days[activeMobileDayIdx].dayOfWeek === "土" ? "text-blue-400" : days[activeMobileDayIdx].dayOfWeek === "日" ? "text-rose-400" : "text-cyan-400"}`}>
                      {days[activeMobileDayIdx].label} ({days[activeMobileDayIdx].dayOfWeek})
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
                    const isUniversityDisabled = universityStatus.isDisabled;
                    const isSystemDisabled = (!(day.dayOfWeek === "日" || day.dayOfWeek === "土") && time.label >= "10:00" && time.label < "18:00") || isUniversityDisabled;

                    const slotDate = new Date(day.dateObj);
                    slotDate.setHours(startHour, 0, 0, 0);
                    const isPast = slotDate < today;

                    const isDisabled = (isSystemDisabled && !bookingData) || (isPast && !bookingData);
                    const isSelected = selectedSlots.includes(slotId);

                    const stripeClass = isSystemDisabled && !bookingData
                      ? "bg-[linear-gradient(135deg,#020617_25%,#0f172a_25%,#0f172a_50%,#020617_50%,#020617_75%,#0f172a_75%,#0f172a_100%)] bg-[length:16px_16px] opacity-40"
                      : "";

                    return (
                      <div key={time.label} className="flex items-center gap-3">
                        <div className="w-12 text-center font-black text-xs text-slate-500 font-mono">{time.label}</div>
                        <button
                          className={`flex-1 rounded-2xl py-3.5 px-4 text-left transition-all font-bold text-sm min-h-14 border flex items-center justify-between duration-100
                            ${stripeClass}
                            ${isDisabled
                              ? "border-slate-950 bg-slate-950/30 text-slate-700 cursor-not-allowed"
                              : bookingData
                                ? isPast
                                  ? "border-slate-900 bg-slate-950/20 text-slate-600"
                                  : "border-indigo-500/20 bg-indigo-950/20 text-indigo-200 active:scale-[0.98] cursor-pointer"
                                : isSelected
                                  ? "border-cyan-400 bg-cyan-950/40 text-cyan-300 active:scale-[0.98] cursor-pointer"
                                  : "border-slate-800/80 bg-slate-950 text-slate-400 active:scale-[0.98] cursor-pointer"}`}
                          disabled={isDisabled || (isPast && !!bookingData)}
                          onClick={() => {
                            if (bookingData) {
                              setCancelTargetSlot(slotId);
                            } else {
                              handleSlotClick(slotId);
                            }
                          }}
                        >
                          {universityStatus.isDisabled ? (
                            <span className="text-[11px] text-rose-500 font-black flex items-center gap-1">✕ <span className="bg-rose-950/10 border border-rose-900/20 px-2 py-0.5 rounded-lg text-[10px]">{universityStatus.reason}</span></span>
                          ) : isSystemDisabled ? <span className="text-slate-700 font-normal text-[11px]">✕ 授業のため利用不可</span>
                            : bookingData ? (
                              <div className="flex justify-between items-center w-full min-w-0 gap-2">
                                <span className={`font-black truncate flex-1 ${isPast ? "text-slate-500 line-through" : "text-slate-200"}`}>👤 {bookingData.userName} {isPast && "(終了)"}</span>
                                <span className={`text-[10px] bg-slate-950 border px-2 py-0.5 rounded-md font-mono font-bold shrink-0 ${isPast ? "text-slate-700 border-slate-900" : "text-slate-500 border-slate-800"}`}>{bookingData.studentId}</span>
                              </div>
                            ) : isPast ? <span className="text-[11px] text-slate-700 font-normal">🕒 利用不可（終了）</span>
                              : isSelected ? (
                                <div className="flex justify-between items-center w-full text-cyan-400 font-black">
                                  <span>✓ 選択中</span>
                                  <span className="text-xs bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-lg">キープ</span>
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
                  {/* 💡 【スマホ曜日潰れ対策】
                      ボタン幅を固定値ではなくパーセンテージ（flex-1 / w-full）で均等分配させ、
                      パディング（px-0.5）と文字サイズ（text-[11px]）を極限まで最適化し、
                      絶対に文字が改行されて潰れないようにプロ仕様に組み直しました。 */}
                  <div className="flex gap-1 justify-between w-full pb-2.5">
                    {days.map((day, idx) => {
                      const isSelectedDay = activeMobileDayIdx === idx;
                      const isToday = day.label === todayString && dayOffset === 0;
                      return (
                        <button
                          key={day.label}
                          onClick={() => setActiveMobileDayIdx(idx)}
                          className={`flex-1 min-w-0 py-2 px-0.5 rounded-xl border text-center transition-all duration-100 active:scale-95 cursor-pointer
                            ${isSelectedDay
                              ? "bg-gradient-to-b from-indigo-500 to-indigo-600 border-indigo-400 text-white font-black shadow-xl shadow-indigo-950/80 scale-105 ring-2 ring-indigo-400/30"
                              : isToday
                                ? "bg-slate-900 border-indigo-500/40 text-indigo-300 font-bold opacity-70"
                                : "bg-slate-900/20 border-slate-800/60 text-slate-600 opacity-50"}`}
                        >
                          <div className={`text-[11px] font-black tracking-tighter ${isSelectedDay ? "text-white" : day.dayOfWeek === "土" ? "text-blue-500" : day.dayOfWeek === "日" ? "text-rose-500" : "text-slate-400"}`}>{day.label}</div>
                          <div className={`text-[9px] font-bold scale-90 ${isSelectedDay ? "text-indigo-100" : "text-slate-600"}`}>({day.dayOfWeek})</div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mt-2">
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
                {isSelectedSlotsContinuous() ? (
                  <p className="text-xs font-bold text-slate-300 mt-0.5 truncate font-mono">{getSortedSelectedLabels()}</p>
                ) : (
                  <p className="text-xs font-black text-rose-400 mt-0.5 animate-pulse">⚠️ 離れたコマは同時予約できません</p>
                )}
              </div>
              <span className="text-xs font-black bg-cyan-500 text-slate-950 px-2.5 py-1 rounded-xl shadow-md font-mono shrink-0 ml-2">
                {selectedSlots.length}/2 コマ
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setSelectedSlots([])} className="bg-slate-950 hover:bg-slate-800 text-slate-400 font-black text-[11px] py-2.5 rounded-xl border border-slate-800 active:scale-95 cursor-pointer">クリア</button>

              <button
                onClick={() => setIsBookModalOpen(true)}
                disabled={!isSelectedSlotsContinuous()}
                className={`col-span-2 font-black text-xs py-2.5 rounded-xl active:scale-95 shadow-lg flex items-center justify-center gap-1.5 duration-100
                  ${isSelectedSlotsContinuous()
                    ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950/40 cursor-pointer"
                    : "bg-slate-800 text-slate-600 border border-slate-800/50 cursor-not-allowed shadow-none"}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                予約手続きへ
              </button>
            </div>
          </div>
        )}

        <Modals
          isBookModalOpen={isBookModalOpen}
          setIsBookModalOpen={setIsBookModalOpen}
          selectedSlots={selectedSlots}
          setSelectedSlots={setSelectedSlots}
          userName={userName}
          setUserName={setUserName}
          studentId={studentId}
          setStudentId={setStudentId}
          isFormValid={isFormValid}
          isSubmitting={isSubmitting}
          handleBookSubmit={handleBookSubmit}
          cancelTargetSlot={cancelTargetSlot}
          setCancelTargetSlot={setCancelTargetSlot}
          currentCancelBooking={currentCancelBooking}
          handleCancelSubmit={handleCancelSubmit}
          isSubmittingCancel={isSubmittingCancel}
        />

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