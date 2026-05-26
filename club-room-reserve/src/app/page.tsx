"use client"

import React, { useState } from "react"

const generateInitialDays = (offset: number) => {
  const generateDays = [];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  const today = new Date();
  const currentDayOfWeek = today.getDay();

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - currentDayOfWeek + i + offset);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const label = month + "/" + date;

    const dayName = dayNames[d.getDay()];

    generateDays.push({
      label: label,
      dayOfWeek: dayName
    });
  }
  return generateDays;
}

const generateTimes = () => {
  const times = [];
  for (let i = 10; i < 23; i++) {
    const label = i + ":00";
    times.push({ label: label });
  }
  return times;
};

const bookedSlots = ["10:00 5/26", "13:00 5/27", "19:00 5/26"];

export default function ReservationPage() {
  const [dayOffset, setDayOffset] = useState(0);
  const days = generateInitialDays(dayOffset);
  const [times] = useState(() => generateTimes());

  // 💡 記憶のための箱
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [userName, setUserName] = useState("");
  const [studentId, setStudentId] = useState("");



  const isFormValid = userName.trim() !== "" && studentId.trim() !== "";

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <div className="max-w-5xl mx-auto">

        {/* タイトルエリア */}
        <h1 className="text-3xl font-bold text-center mb-2 text-indigo-600">
          🎵 音スタ 予約アプリ 🎵
        </h1>
        <p className="text-center text-gray-500 mb-8 text-sm">
          一から作る、僕たちのオリジナル予約システム
        </p>

        <div className="flex justify-between items-center mb-4 px-2">
          <button
            onClick={() => setDayOffset(dayOffset - 7)}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-2 px-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            ← 前の週
          </button>
          <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {dayOffset === 0 ? "今週" : `${dayOffset / 7}週間後の週`}
          </span>
          <button
            onClick={() => setDayOffset(dayOffset + 7)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors shadow-sm"
          >
            次の週 →
          </button>        </div>

        {/* スケジュール表 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-8 gap-2 mb-4 text-center font-bold">
            <div>時間</div>
            {days.map((day) => (
              <div key={day.label}>
                <div>{day.label}</div>
                <div className="text-xs text-gray-400 font-normal">
                  ({day.dayOfWeek})
                </div>
              </div>
            ))}
          </div>

          {/* 時間ごとの行（二重ループ） */}
          {times.map((time) => (
            <div key={time.label} className="grid grid-cols-8 gap-2 mb-4 text-center font-bold">
              <div className="text-gray-500">{time.label}</div>

              {days.map((day) => {
                const slotId = time.label + " " + day.label;
                const isBooked = bookedSlots.includes(slotId);
                return (
                  <button
                    key={time.label + "-" + day.label}
                    className={`border rounded-lg py-2 transition-colors font-bold
                      ${isBooked
                        ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-indigo-50 hover:border-indigo-200"
                      }`}
                    disabled={isBooked}
                    onClick={() => setSelectedSlot(day.label + " " + time.label)}
                  >
                    {isBooked ? "✕" : "+"}
                  </button>
                )
              })}
            </div>
          ))}

        </div> {/* 白いボックスの終わり */}

        {/* 選択された日時を画面の下に表示するエリア */}
        {selectedSlot && (
          // 💡 画面全体を覆う暗い背景（真ん中に寄せる魔法）
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">

            {/* 💡 真ん中に浮かぶ白いボックス（ここを綺麗に整えました） */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-100 animate-scale-in">

              <h2 className="text-xl font-bold text-indigo-600 mb-2">予約内容の入力</h2>
              <p className="text-gray-600 text-sm mb-4">
                現在 <span className="font-bold text-indigo-600">{selectedSlot}</span> を選択しています
              </p>

              {/* 入力欄の並び */}
              <div className="space-y-3 text-left mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 pl-1">お名前</label>
                  <input
                    type="text"
                    placeholder="名前"
                    value={userName}
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
                    onChange={(e) => setStudentId(e.target.value)}
                    className="border border-gray-200 p-2.5 rounded-xl w-full text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
              </div>

              {/* ボタンの並び */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    alert(`${userName}さん（学籍番号: ${studentId}）\n${selectedSlot} で予約を確定しました！`);
                    setSelectedSlot(null);
                    setUserName("");
                    setStudentId("");
                  }}
                  className={`w-full font-bold py-2.5 rounded-xl transition-colors shadow-md text-sm
                    ${isFormValid
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}                >
                  この日時で予約を確定する
                </button>
                <button
                  onClick={() => {
                    setSelectedSlot(null);
                    setUserName("");
                    setStudentId("");
                  }}
                  className="w-full bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  キャンセル
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}