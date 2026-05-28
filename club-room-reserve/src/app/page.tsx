"use client"

import React, { useState, useEffect } from "react"
import dynamic from "next/dynamic"

const GAS_URL = "https://script.google.com/macros/s/AKfycbz-LqUv0ys35_1rOx4spWmIiO4LoeD1K_bmVyiDmzZ5T7jEJZqucDHdHd4n1pOjkEEuzg/exec";

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
    const label = month + "/" + date;
    const dayName = dayNames[d.getDay()];

    const year = d.getFullYear();
    const compareFormat = `${year}/${month}/${date}`;

    generateDays.push({
      label: label,
      dayOfWeek: dayName,
      dateObj: d,
      compareFormat: compareFormat
    });
  }
  return generateDays;
}

const generateTimes = () => {
  const times = [];
  for (let i = 10; i < 22; i++) {
    const label = i + ":00";
    times.push({ label: label });
  }
  return times;
};

interface BookedSlot {
  slotId: string;
  userName: string;
  studentId: number;
}

function ReservationPage() {
  const [dayOffset, setDayOffset] = useState(0);
  const days = generateInitialDays(dayOffset);
  const [times] = useState(() => generateTimes());

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [studentId, setStudentId] = useState("");

  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [disabledDates, setDisabledDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  const todayString = `${today.getMonth() + 1}/${today.getDate()}`;

  // 💡 【ここを修正】useEffectの監視対象（[]）を空っぽにして、アプリ起動時の「最初の1回だけ」通信するようにしました！
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        setBookedSlots(data.bookedSlots || []);
        setDisabledDates(data.disabledDates || []);
      } catch (e) {
        console.error("データの取得に失敗しました", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []); // 👈 dayOffset を削除！これで週切り替え時の通信がゼロになります

  const isFormValid = userName.trim() !== "" && studentId.trim() !== "";

  const getWeekLabel = () => {
    if (dayOffset === 0) return "今週";
    if (dayOffset === 7) return "来週";
    if (dayOffset === -7) return "先週";
    if (dayOffset > 7) return `${dayOffset / 7}週間後の週`;
    return `${Math.abs(dayOffset / 7)}週間前の週`;
  };

  const refreshDataOnly = async () => {
    try {
      const res = await fetch(GAS_URL);
      const data = await res.json();
      setBookedSlots(data.bookedSlots || []);
      setDisabledDates(data.disabledDates || []);
    } catch (e) {
      console.error("再同期に失敗しました", e);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot || isSubmitting) return;
    setIsSubmitting(true);

    const newBooking = {
      action: "book",
      slotId: selectedSlot,
      userName: userName,
      studentId: Number(studentId)
    };

    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify(newBooking),
      });
      const result = await res.json();

      if (result.success) {
        setBookedSlots([...bookedSlots, { slotId: selectedSlot, userName, studentId: Number(studentId) }]);
        setSelectedSlot(null);
        setUserName("");
        setStudentId("");
      } else {
        alert(result.error === "Already booked" ? "タッチの差で既に他の人に予約されてしまいました。" : "予約に失敗しました。");
        refreshDataOnly();
      }
    } catch (e) {
      console.error("予約通信エラー:", e);
      alert("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedSlot || isSubmitting) return;
    setIsSubmitting(true);

    const cancelData = {
      action: "cancel",
      slotId: selectedSlot
    };

    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify(cancelData),
      });
      const result = await res.json();

      if (result.success) {
        setBookedSlots(bookedSlots.filter(b => b.slotId !== selectedSlot));
        setSelectedSlot(null);
        setUserName("");
        setStudentId("");
      } else {
        alert("キャンセルの処理に失敗しました。既に他の操作が行われた可能性があります。");
        refreshDataOnly();
      }
    } catch (e) {
      console.error("キャンセル通信エラー:", e);
      alert("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
        <p className="text-sm font-medium">最新の予約状況をスプレッドシートから読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-800">
      <div className="max-w-5xl mx-auto">

        {/* タイトルエリア */}
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-2 text-indigo-600">
          🎵 音スタ 予約アプリ 🎵
        </h1>
        <p className="text-center text-gray-500 mb-6 md:mb-8 text-xs md:text-sm">
          一から作る、僕たちのオリジナル予約システム
        </p>

        {/* 週切り替えボタン */}
        <div className="flex justify-between items-center mb-4 px-2">
          <button
            onClick={() => setDayOffset(dayOffset - 7)}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-2 px-3 rounded-xl text-xs md:text-sm transition-colors shadow-sm"
          >
            ← 前の週
          </button>

          <span className="text-xs md:text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {getWeekLabel()}
          </span>

          <button
            onClick={() => setDayOffset(dayOffset + 7)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs md:text-sm transition-colors shadow-sm"
          >
            次の週 →
          </button>
        </div>

        {/* 📱 スケジュール表の親ボックス */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm overflow-x-auto">
          <div className="min-w-[800px] pr-2">

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-8 gap-2 mb-4 text-center font-bold">
              <div className="sticky left-0 z-20 bg-white font-normal flex items-center justify-center text-sm shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] py-1 text-gray-400">
                時間
              </div>
              {days.map((day) => {
                const isToday = day.label === todayString && dayOffset === 0;

                return (
                  <div
                    key={day.label}
                    className={`text-sm md:text-base py-1 rounded-xl transition-colors ${isToday
                      ? "bg-indigo-50 border border-indigo-200 text-indigo-700 ring-2 ring-indigo-600/10"
                      : ""
                      }`}
                  >
                    <div>{day.label}</div>
                    <div className={`text-xs font-normal ${isToday ? "text-indigo-500" : "text-gray-400"}`}>
                      ({day.dayOfWeek})
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 時間ごとの行 */}
            {times.map((time) => {
              const startHour = parseInt(time.label);

              return (
                <div key={time.label} className="grid grid-cols-8 gap-2 mb-3 text-center font-bold items-center">

                  {/* 左端の時間表示 */}
                  <div className="sticky left-0 z-10 bg-white text-gray-500 flex items-center justify-center h-full text-xs md:text-sm font-medium border border-gray-100 rounded-lg py-3 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                    {startHour}:00 ～
                  </div>

                  {days.map((day) => {
                    const slotId = time.label + " " + day.label;
                    const isWeekdayLine = day.dayOfWeek !== "日" && day.dayOfWeek !== "土";
                    const isClassTime = time.label >= "10:00" && time.label < "18:00";

                    const bookingData = bookedSlots.find(b => b.slotId === slotId);

                    const isUniversityDisabled = disabledDates.includes(day.compareFormat);
                    const isSystemDisabled = (isWeekdayLine && isClassTime) || isUniversityDisabled;

                    const now = new Date();
                    const slotDate = new Date(day.dateObj);
                    slotDate.setHours(startHour, 0, 0, 0);

                    const isPast = slotDate < now;
                    const isDisabled = isSystemDisabled || isPast;

                    return (
                      <button
                        key={time.label + "-" + day.label}
                        className={`border rounded-lg py-3 transition-colors font-bold text-sm min-h-[56px] flex flex-col items-center justify-center
                        ${isDisabled
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : bookingData
                              ? "border-gray-300 bg-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-300 cursor-pointer"
                              : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer"
                          }`}
                        disabled={isDisabled}
                        onClick={() => {
                          setUserName(bookingData ? bookingData.userName : "");
                          setStudentId(bookingData ? String(bookingData.studentId) : "");
                          setSelectedSlot(slotId)
                        }}
                      >
                        {isSystemDisabled ? (
                          "✕"
                        ) : isPast ? (
                          <span className="text-xs text-gray-300 font-normal">終了</span>
                        ) : bookingData ? (
                          <div className="w-full px-1 truncate">
                            <div className="text-xs font-bold text-gray-800">{bookingData.userName}</div>
                            <div className="text-[10px] text-gray-400 font-normal tracking-tighter">
                              {bookingData.studentId}
                            </div>
                          </div>
                        ) : (
                          "+"
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}

          </div>
        </div>

        {/* モーダルエリア */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-100">

              {bookedSlots.some(b => b.slotId === selectedSlot) ? (
                <>
                  <h2 className="text-xl font-bold text-red-600 mb-2">予約の確認・キャンセル</h2>
                  <p className="text-gray-600 text-sm mb-4">
                    現在 <span className="font-bold text-red-600">{selectedSlot}</span> は予約されています
                  </p>

                  <div className="space-y-3 text-center mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <span className="block text-xs font-bold text-gray-400 mb-1">予約者</span>
                      <span className="text-base font-bold text-gray-800">{userName} さん</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-400 mb-1">学籍番号</span>
                      <span className="text-base font-bold text-gray-800">{studentId}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className={`w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-md
                        ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isSubmitting ? "キャンセル送信中..." : "この予約をキャンセルする"}
                    </button>
                    <button
                      onClick={() => setSelectedSlot(null)}
                      disabled={isSubmitting}
                      className="w-full bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 font-bold py-2.5 rounded-xl text-sm transition-colors"
                    >
                      閉じる
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-indigo-600 mb-2">予約内容の入力</h2>
                  <p className="text-gray-600 text-sm mb-4">
                    現在 <span className="font-bold text-indigo-600">{selectedSlot}</span> を選択しています
                  </p>

                  <div className="space-y-3 text-left mb-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 pl-1">お名前</label>
                      <input
                        type="text"
                        placeholder="名前"
                        value={userName}
                        disabled={isSubmitting}
                        onChange={(e) => setUserName(e.target.value)}
                        className="border border-gray-200 p-2.5 rounded-xl w-full text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 pl-1">学籍番号</label>
                      <input
                        type="number"
                        placeholder="学籍番号"
                        value={studentId}
                        disabled={isSubmitting}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="border border-gray-200 p-2.5 rounded-xl w-full text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleBook}
                      disabled={!isFormValid || isSubmitting}
                      className={`w-full font-bold py-2.5 rounded-xl transition-colors shadow-md text-sm
                        ${isFormValid && !isSubmitting
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                      {isSubmitting ? "予約書き込み中..." : "この日時で予約を確定する"}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSlot(null);
                        setUserName("");
                        setStudentId("");
                      }}
                      disabled={isSubmitting}
                      className="w-full bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 font-bold py-2.5 rounded-xl text-sm transition-colors"
                    >
                      キャンセル
                    </button>
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