"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"

const GAS_URL = "https://script.google.com/macros/s/AKfycbz-LqUv0ys35_1rOx4spWmIiO4LoeD1K_bmVyiDmzZ5T7jEJZqucDHdHd4n1pOjkEEuzg/exec";

// 外部ヘルパー関数：日付データの生成
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

    generateDays.push({
      label: `${month}/${date}`,
      dayOfWeek: dayNames[d.getDay()],
      dateObj: d,
      compareFormat: `${d.getFullYear()}/${month}/${date}`
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

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [cancelInputId, setCancelInputId] = useState("");
  const [myReservationQuery, setMyReservationQuery] = useState(""); // 💡 マイ予約検索用の学籍番号State

  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [disabledDates, setDisabledDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const today = new Date();
  const todayString = `${today.getMonth() + 1}/${today.getDate()}`;

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

  // 💡 【新ロジック】入力された学籍番号に一致する予約を日付順にソートして抽出
  const myReservations = bookedSlots
    .filter(b => b.studentId === Number(myReservationQuery.trim()))
    .sort((a, b) => {
      const extractDate = (slotId: string) => {
        const parts = slotId.split(" "); // ["13:00", "5/28"]
        if (parts.length < 2) return new Date(0);
        const [month, date] = parts[1].split("/").map(Number);
        const [hour, min] = parts[0].split(":").map(Number);
        const now = new Date();
        return new Date(now.getFullYear(), month - 1, date, hour, min);
      };
      return extractDate(a.slotId).getTime() - extractDate(b.slotId).getTime();
    });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
        <p className="text-sm font-medium">最新の予約状況をスプレッドシートから読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-800 relative">

      {/* トースト通知センター */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-4 rounded-xl shadow-lg border text-sm font-bold pointer-events-auto flex items-center bg-white transition-all
              ${t.type === "success" ? "border-green-200 text-green-700" : "border-red-200 text-red-600"}`}
          >
            <span className="mr-2">{t.type === "success" ? "✅" : "⚠️"}</span>
            {t.message}
          </div>
        ))}
      </div>

      <div className="max-w-5xl mx-auto">

        {/* タイトルエリア */}
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-2 text-indigo-600">🎵 音スタ 予約アプリ 🎵</h1>
        <p className="text-center text-gray-500 mb-6 md:mb-8 text-xs md:text-sm">一から作る、僕たちのオリジナル予約システム</p>

        {/* 週切り替えボタン */}
        <div className="flex justify-between items-center mb-4 px-2">
          <button onClick={() => setDayOffset(dayOffset - 7)} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-2 px-3 rounded-xl text-xs md:text-sm transition-colors shadow-sm">← 前の週</button>
          <span className="text-xs md:text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{getWeekLabel()}</span>
          <button onClick={() => setDayOffset(dayOffset + 7)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs md:text-sm transition-colors shadow-sm">次の週 →</button>
        </div>

        {/* スケジュール表 */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm overflow-x-auto mb-8">
          <div className="min-w-[800px] pr-2">

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-8 gap-2 mb-4 text-center font-bold">
              <div className="sticky left-0 z-20 bg-white font-normal flex items-center justify-center text-sm shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] py-1 text-gray-400">時間</div>
              {days.map((day) => {
                const isToday = day.label === todayString && dayOffset === 0;
                return (
                  <div key={day.label} className={`text-sm md:text-base py-1 rounded-xl transition-colors ${isToday ? "bg-indigo-50 border border-indigo-200 text-indigo-700 ring-2 ring-indigo-600/10" : ""}`}>
                    <div>{day.label}</div>
                    <div className={`text-xs font-normal ${isToday ? "text-indigo-500" : "text-gray-400"}`}>({day.dayOfWeek})</div>
                  </div>
                )
              })}
            </div>

            {/* 時間ごとの行 */}
            {times.map((time) => {
              const startHour = parseInt(time.label);

              return (
                <div key={time.label} className="grid grid-cols-8 gap-2 mb-3 text-center font-bold items-center">
                  <div className="sticky left-0 z-10 bg-white text-gray-500 flex items-center justify-center h-full text-xs md:text-sm font-medium border border-gray-100 rounded-lg py-3 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">{startHour}:00 ～</div>

                  {days.map((day) => {
                    const slotId = `${time.label} ${day.label}`;
                    const isWeekend = day.dayOfWeek === "日" || day.dayOfWeek === "土";
                    const isClassTime = time.label >= "10:00" && time.label < "18:00";
                    const bookingData = bookedSlots.find(b => b.slotId === slotId);

                    const isUniversityDisabled = disabledDates.some(d => {
                      const cleanD = d.replace(/\s+/g, ' ').trim();
                      const fullDayFormat = day.compareFormat.trim();
                      const timeFormat = `${time.label} ${day.compareFormat}`.replace(/\s+/g, ' ').trim();
                      return cleanD === fullDayFormat || cleanD === timeFormat;
                    });

                    const isSystemDisabled = (!isWeekend && isClassTime) || isUniversityDisabled;

                    const slotDate = new Date(day.dateObj);
                    slotDate.setHours(startHour, 0, 0, 0);
                    const isPast = slotDate < today;
                    const isDisabled = isSystemDisabled || isPast;

                    return (
                      <button
                        key={`${time.label}-${day.label}`}
                        className={`border rounded-lg py-3 transition-colors font-bold text-sm min-h-[56px] flex flex-col items-center justify-center
                          ${isDisabled ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : bookingData ? "border-gray-300 bg-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-300 cursor-pointer"
                              : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer"}`}
                        disabled={isDisabled}
                        onClick={() => {
                          setUserName(bookingData ? bookingData.userName : "");
                          setStudentId(bookingData ? String(bookingData.studentId) : "");
                          setCancelInputId("");
                          setSelectedSlot(slotId)
                        }}
                      >
                        {isUniversityDisabled ? <span className="text-xs text-red-500 font-bold">使用禁止</span>
                          : isSystemDisabled ? "✕"
                            : isPast ? <span className="text-xs text-gray-300 font-normal">終了</span>
                              : bookingData ? (
                                <div className="w-full px-1 truncate">
                                  <div className="text-xs font-bold text-gray-800">{bookingData.userName}</div>
                                  <div className="text-[10px] text-gray-400 font-normal tracking-tighter">{bookingData.studentId}</div>
                                </div>
                              ) : "+"}
                      </button>
                    )
                  })}
                </div>
              )
            })}

          </div>
        </div>

        {/* 💡 【新機能】マイ予約確認エリア */}
        <div className="max-w-md mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center mb-12">
          <h3 className="text-sm font-bold text-gray-500 mb-3">🔎 自分の予約一覧を確認</h3>
          <input
            type="number"
            placeholder="学籍番号（7桁）を入力して検索"
            value={myReservationQuery}
            onChange={(e) => setMyReservationQuery(e.target.value)}
            className="border border-gray-200 p-2.5 rounded-xl w-full text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 mb-4"
          />

          {myReservationQuery.trim() && (
            <div className="space-y-2 text-left">
              {myReservations.length > 0 ? (
                myReservations.map((res, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm bg-indigo-50/50 px-4 py-2.5 rounded-xl border border-indigo-100/50 text-indigo-950 font-medium">
                    <span>📅 {res.slotId.split(" ")[1]} （{res.slotId.split(" ")[0]}〜）</span>
                    <span className="text-xs text-indigo-500 bg-white border border-indigo-200/60 px-2 py-0.5 rounded-md font-bold">{res.userName}さん</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">現在、この学籍番号の予約はありません。</p>
              )}
            </div>
          )}
        </div>

        {/* モーダルエリア */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-100">

              {currentModalBooking ? (
                <>
                  <h2 className="text-xl font-bold text-red-600 mb-2">予約の確認・キャンセル</h2>
                  <p className="text-gray-600 text-sm mb-4">現在 <span className="font-bold text-red-600">{selectedSlot}</span> は予約されています</p>

                  <div className="space-y-3 text-center mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <span className="block text-xs font-bold text-gray-400 mb-1">予約者</span>
                      <span className="text-base font-bold text-gray-800">{userName} さん</span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 mb-1 pl-1 text-left">確認のため登録時の学籍番号（7桁）を入力</label>
                    <input
                      type="number"
                      placeholder="学籍番号を入力"
                      value={cancelInputId}
                      onChange={(e) => setCancelInputId(e.target.value)}
                      className="border border-gray-200 p-2.5 rounded-xl w-full text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={!isCancelValid || isSubmitting}
                      className={`w-full text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-md 
                        ${isCancelValid && !isSubmitting ? "bg-red-600 hover:bg-red-700" : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"}`}
                    >
                      {isSubmitting ? "キャンセル送信中..." : "この予約をキャンセルする"}
                    </button>
                    <button onClick={() => setSelectedSlot(null)} disabled={isSubmitting} className="w-full bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 font-bold py-2.5 rounded-xl text-sm transition-colors">閉じる</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-indigo-600 mb-2">予約内容の入力</h2>
                  <p className="text-gray-600 text-sm mb-4">現在 <span className="font-bold text-indigo-600">{selectedSlot}</span> を選択しています</p>

                  <div className="space-y-3 text-left mb-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 pl-1">お名前</label>
                      <input type="text" placeholder="名前" value={userName} disabled={isSubmitting} onChange={(e) => setUserName(e.target.value)} className="border border-gray-200 p-2.5 rounded-xl w-full text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 pl-1">
                        学籍番号 <span className={`text-[10px] ${isStudentIdValid ? "text-green-600" : "text-gray-400"}`}>(7桁の数字)</span>
                      </label>
                      <input type="number" placeholder="7桁の数字を入力" value={studentId} disabled={isSubmitting} onChange={(e) => setStudentId(e.target.value)} className="border border-gray-200 p-2.5 rounded-xl w-full text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button onClick={handleBook} disabled={!isFormValid || isSubmitting} className={`w-full font-bold py-2.5 rounded-xl transition-colors shadow-md text-sm ${isFormValid && !isSubmitting ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
                      {isSubmitting ? "予約書き込み中..." : "この日時で予約を確定する"}
                    </button>
                    <button onClick={() => { setSelectedSlot(null); setUserName(""); setStudentId(""); }} disabled={isSubmitting} className="w-full bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 font-bold py-2.5 rounded-xl text-sm transition-colors">キャンセル</button>
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
  loading: () => <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">読み込み中...</div>
})