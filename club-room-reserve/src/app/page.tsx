"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"

// =============================================================================
// 1. 定数・外部設定
// =============================================================================
// Google Apps Script (GAS) のWebアプリURL
const GAS_URL = "https://script.google.com/macros/s/AKfycbz-LqUv0ys35_1rOx4spWmIiO4LoeD1K_bmVyiDmzZ5T7jEJZqucDHdHd4n1pOjkEEuzg/exec";

// =============================================================================
// 2. 型定義 (TypeScriptのインターフェース)
// =============================================================================
interface BookedSlot {
  slotId: string;    // 例: "10:00 2026/05/24" (バグ防止のため西暦を含める)
  userName: string;  // 予約者の名前
  studentId: number; // 7桁の学籍番号
}

interface DisabledDateObject {
  date: string;     // 貸切日のフォーマット
  reason?: string;  // 貸切の理由（「定期メンテ」など）
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

// =============================================================================
// 3. 外部ヘルパー関数（日付・時間の一括生成ロジック）
// =============================================================================
/**
 * 指定された週オフセット（例: 0=今週, 7=来週, -7=先週）に基づいて、1週間分（日〜土）の日付データを生成する関数
 * ★年またぎバグを防ぐため、裏データ用に必ず「西暦(getFullYear)」を組み込む仕様に改造
 */
const generateInitialDays = (offset: number) => {
  const generateDays = [];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 今日は何曜日か (0:日 ~ 6:土)

  // 日曜日(0)から土曜日(6)までの7日間をループ処理
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    // 日曜日を起点にして、日数を加減算してターゲットの日付を計算
    d.setDate(today.getDate() - currentDayOfWeek + i + offset);
    d.setHours(0, 0, 0, 0);

    const month = d.getMonth() + 1;
    const date = d.getDate();

    // GAS側との文字列完全一致バグを防ぐため、月日を「01」「09」のようにゼロ埋め処理
    const mm = String(month).padStart(2, '0');
    const dd = String(date).padStart(2, '0');

    generateDays.push({
      label: `${month}/${date}`, // 画面表示用 (例: "5/24")
      dayOfWeek: dayNames[d.getDay()], // 曜日文字 (例: "金")
      dateObj: d, // 過去判定に使う生の日付オブジェクト
      compareFormat: `${d.getFullYear()}/${mm}/${dd}` // 西暦入りの裏データ用 (例: "2026/05/24")
    });
  }
  return generateDays;
}

/**
 * 予約システムが扱う時間軸（10:00 〜 21:00）を生成する関数
 */
const generateTimes = () => {
  const times = [];
  for (let i = 10; i < 22; i++) {
    times.push({ label: `${i}:00` });
  }
  return times;
};


// =============================================================================
// 4. メインコンポーネント
// =============================================================================
function ReservationPage() {

  // ---------------------------------------------------------------------------
  // 4-1. 状態管理 (useState)
  // ---------------------------------------------------------------------------

  // 週の移動オフセット（0: 今週、7: 1週間後、-7: 1週間前）
  // ※画面リロード対策として sessionStorage から前回値を引き継ぐ
  const [dayOffset, setDayOffset] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("dayOffset");
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });

  // オフセットに基づいて、今画面に表示すべき7日間を自動計算
  const days = generateInitialDays(dayOffset);
  // 時間軸データの読み込み
  const [times] = useState(() => generateTimes());

  // 今日の「月/日」を取得（スマホ版の初期タブを「今日」に合わせる判定用）
  const today = new Date();
  const todayString = `${today.getMonth() + 1}/${today.getDate()}`;

  // 【スマホ専用】現在選択されている曜日のインデックス (0=日曜日 〜 6=土曜日)
  // 初期値は「今週なら今日の曜日」「先週や来週なら0（日曜日）」を自動セットしてバグを防止
  const [activeMobileDayIdx, setActiveMobileDayIdx] = useState<number>(() => {
    const initialDays = generateInitialDays(dayOffset);
    const todayIdx = initialDays.findIndex(d => d.label === todayString);
    return todayIdx !== -1 && dayOffset === 0 ? todayIdx : 0;
  });

  // モーダル・入力フォーム関連のステート
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null); // 現在選択中のスロットID
  const [userName, setUserName] = useState("");                          // 予約登録：名前入力欄
  const [studentId, setStudentId] = useState("");                        // 予約登録：学籍番号入力欄
  const [cancelInputId, setCancelInputId] = useState("");                // 予約取消：本人確認用入力欄
  const [myReservationQuery, setMyReservationQuery] = useState("");      // 検索：マイ予約検索窓

  // GASから取得する外部データ用のステート
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);                  // すでに埋まっている枠のリスト
  const [disabledDates, setDisabledDates] = useState<(string | DisabledDateObject)[]>([]); // 大学やサークルが指定した「貸切・禁止日」のリスト
  const [isLoading, setIsLoading] = useState(true);                                  // 初回ローディング管理
  const [isSubmitting, setIsSubmitting] = useState(false);                            // 連打・二重送信防止フラグ
  const [toasts, setToasts] = useState<Toast[]>([]);                                 // 画面上のポップアップ通知

  // ---------------------------------------------------------------------------
  // 4-2. ビジネスロジック・イベント関数
  // ---------------------------------------------------------------------------

  /**
   * 【スマホ・PC共通】週を変更したときに呼び出す安全なハンドラ
   * 週の移動(setDayOffset)と、スマホ版の曜日タブ選択(setActiveMobileDayIdx)を1つのイベント内で同時に処理し、Reactの無限ループ警告を回避。
   */
  const handleWeekChange = (newOffset: number) => {
    setDayOffset(newOffset);
    const nextDays = generateInitialDays(newOffset);
    const todayIdx = nextDays.findIndex(d => d.label === todayString);
    // 新しく移動した週に「今日」が含まれていればその曜日を、そうでなければ日曜日(0)を自動選択
    setActiveMobileDayIdx(todayIdx !== -1 && newOffset === 0 ? todayIdx : 0);
  };

  /**
   * トースト通知（画面上のポップアップ）を表示する共通関数
   */
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // 選択された「週のオフセット」をブラウザに記憶させる
  useEffect(() => {
    sessionStorage.setItem("dayOffset", dayOffset.toString());
  }, [dayOffset]);

  /**
   * GASから最新の予約状況・貸切状況を一括取得する関数
   */
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(GAS_URL);
      if (!res.ok) throw new Error(`サーバーエラー: ${res.status}`);
      const data = await res.json();
      setBookedSlots(data.bookedSlots || []);
      setDisabledDates(data.disabledDates || []);
    } catch (e) {
      console.warn("予約データの自動更新に失敗しました。次回同期をお待ちください:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 10秒に1回、裏側で自動的にデータを最新化するタイマーを設定
  useEffect(() => {
    const timerId = setTimeout(() => { loadData(); }, 0);
    const intervalId = setInterval(() => { loadData(); }, 10000);
    return () => {
      clearTimeout(timerId);
      clearInterval(intervalId);
    };
  }, [loadData]);

  // モーダル内のバリデーション（入力チェック）ロジック群
  const currentModalBooking = bookedSlots.find(b => b.slotId === selectedSlot);
  const isStudentIdValid = /^[0-9]{7}$/.test(studentId.trim()); // 7桁の数字かチェック
  const isFormValid = userName.trim() !== "" && isStudentIdValid;
  const isCancelValid = currentModalBooking && Number(cancelInputId) === currentModalBooking.studentId;

  /**
   * 現在表示している週がいつなのかを文字で返す関数 (例: 「今週」「来週」「2週間後の週」)
   */
  const getWeekLabel = () => {
    if (dayOffset === 0) return "今週";
    if (dayOffset === 7) return "来週";
    if (dayOffset === -7) return "先週";
    return dayOffset > 0 ? `${dayOffset / 7}週間後の週` : `${Math.abs(dayOffset / 7)}週間前の週`;
  };

  /**
   * 特定の日時が、GASから届いた「貸切禁止リスト」に該当するかどうかを厳密にチェックする関数
   */
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

  /**
   * 予約の登録、またはキャンセルをGASに対してPOST送信する共通API通信処理
   */
  const sendRequest = async (action: "book" | "cancel", payload: object, successCallback: () => void) => {
    if (isSubmitting) return; // 通信中の連打をブロック
    setIsSubmitting(true);
    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action, slotId: selectedSlot, ...payload }),
      });
      const result = await res.json();

      if (result.success) {
        successCallback(); // 画面側の表示変更関数を実行
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
        loadData(); // 失敗した場合は即座に最新データを再引き込み
      }
    } catch (e) {
      console.error(`${action}通信エラー:`, e);
      showToast("通信エラーが発生しました。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 予約を実行ボタンを押した時の処理
  const handleBook = () => {
    sendRequest("book", { userName, studentId: Number(studentId) }, () => {
      if (selectedSlot) {
        setBookedSlots([...bookedSlots, { slotId: selectedSlot, userName, studentId: Number(studentId) }]);
      }
    });
  };

  // キャンセルを実行ボタンを押した時の処理
  const handleCancel = () => {
    sendRequest("cancel", {}, () => {
      setBookedSlots(bookedSlots.filter(b => b.slotId !== selectedSlot));
    });
  };

  // 学籍番号検索窓に入力された際、自分の予約だけをソートして抽出するロジック
  const myReservations = bookedSlots
    .filter(b => b.studentId === Number(myReservationQuery.trim()))
    .map(b => {
      // slotIdの形式 ("10:00 2026/05/24") から日付を復元して時系列順に並び替える
      const [time, dateStr] = b.slotId.split(" ");
      const [year, month, dayNum] = dateStr.split("/").map(Number);
      const [hour] = time.split(":").map(Number);
      const sortDate = new Date(year, month - 1, dayNum, hour, 0);
      return { ...b, time, date: `${month}/${dayNum}`, timestamp: sortDate.getTime() };
    })
    .sort((a, b) => a.timestamp - b.timestamp);


  // ---------------------------------------------------------------------------
  // 4-3. 初回ローディング画面のレンダリング
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <div className="animate-spin h-10 w-10 border-4 border-cyan-500 border-t-transparent rounded-full shadow-md"></div>
        <p className="text-sm font-semibold tracking-wider text-slate-400 animate-pulse">SOUND STUDIO DATA LOADING...</p>
      </div>
    )
  }

  // =============================================================================
  // 5. 画面のメインレイアウト (HTML / Tailwind CSS)
  // =============================================================================
  return (
    // 全体テーマカラー：邦ロック・フェスを意識した「ディープネイビー(bg-slate-950)」をベースに採用
    <div className="min-h-screen bg-slate-950 text-slate-100 relative font-sans antialiased pb-12 selection:bg-cyan-500/20 selection:text-cyan-300">

      {/* --- トースト通知ポップアップセンター --- */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-bold pointer-events-auto flex items-center bg-slate-900/90 transition-all duration-300 animate-in slide-in-from-top-4
              ${t.type === "success" ? "border-emerald-500/30 text-emerald-400 shadow-emerald-950/50" : "border-rose-500/30 text-rose-400 shadow-rose-950/50"}`}
          >
            <span className="mr-3 text-base">{t.type === "success" ? "⚡" : "⚡"}</span>
            {t.message}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">

        {/* --- ヘッダーエリア --- */}
        <header className="text-center mb-6 md:mb-12 pt-4">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400">
            🎸 音スタ 予約システム
          </h1>
          <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">Band Practice Room Reservation</p>
        </header>

        {/* --- Bento Grid（メインレイアウト構成） --- */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

          {/* --- 左サイドバーエリア --- */}
          <div className="lg:col-span-1 space-y-6">

            {/* 【PC版限定パーツ】週切り替え用コントローラー（スマホでは非表示にして下部へ移動） */}
            <div className="hidden md:block bg-slate-900 rounded-3xl p-6 border border-slate-800/80 shadow-xl">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">📅 表示期間の変更</h3>
              <div className="flex flex-col gap-2.5">
                <div className="text-center text-sm font-black text-cyan-400 bg-slate-950 py-2.5 rounded-xl border border-slate-800">
                  {getWeekLabel()}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleWeekChange(dayOffset - 7)} className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold py-2.5 px-3 rounded-xl text-xs transition-all border border-slate-700 shadow-md cursor-pointer">← 前の週</button>
                  <button onClick={() => handleWeekChange(dayOffset + 7)} className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-md cursor-pointer">次の週 →</button>
                </div>
              </div>
            </div>

            {/* 【共通パーツ】マイ予約検索窓 */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800/80 shadow-xl">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">🔎 自分の予約を検索</h3>

              {/* 💡 重要：iOSの勝手画面ズームを防ぐため、スマホ表示時は text-base(16px) を強制適用 */}
              <input
                type="number"
                placeholder="学籍番号(7桁)を入力"
                value={myReservationQuery}
                onChange={(e) => setMyReservationQuery(e.target.value)}
                className="border border-slate-800 p-3 rounded-2xl w-full text-base md:text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-950 text-slate-100 transition-all mb-3"
              />

              {myReservationQuery.trim() && (
                <div className="space-y-2 max-h-55 overflow-y-auto pr-1">
                  {myReservations.length > 0 ? (
                    myReservations.map((res, idx) => (
                      <div key={idx} className="flex flex-col gap-1 text-xs bg-slate-950 border border-slate-800/80 p-3 rounded-xl text-slate-300 hover:border-indigo-500 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-slate-100">📅 {res.date}</span>
                          <span className="text-[10px] text-cyan-400 bg-cyan-950/50 border border-cyan-800/30 px-2 py-0.5 rounded-full font-black">{res.userName}さん</span>
                        </div>
                        <div className="text-slate-500 font-medium">{res.time} ～ 利用予約あり</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-500 text-center py-4 bg-slate-950 rounded-xl border border-dashed border-slate-800">予約が見つかりません</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* --- 右メインコンテンツ：メインカレンダー --- */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-slate-900 rounded-3xl p-4 md:p-6 border border-slate-800/80 shadow-xl">

              {/* ===============================================================
               * 💻 PC・大画面用レイアウト (グリッド形式タイムテーブル)
               * =============================================================== */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-200 pr-1">

                  {/* 曜日ヘッダー部分 */}
                  <div className="grid grid-cols-8 gap-2.5 mb-4 text-center font-bold">
                    {/* スクロールしても左側に固定し続けるTIME列 */}
                    <div className="sticky left-0 z-20 bg-slate-900 font-bold flex items-center justify-center text-xs py-2 text-slate-500 tracking-wider uppercase border-b border-slate-800">TIME</div>

                    {days.map((day) => {
                      const isToday = day.label === todayString && dayOffset === 0;
                      // 💡 土日の色付け判定
                      const isSaturday = day.dayOfWeek === "土";
                      const isSunday = day.dayOfWeek === "日";

                      return (
                        <div
                          key={day.label}
                          className={`text-xs md:text-sm py-2 rounded-2xl transition-all border ${isToday
                              ? "bg-gradient-to-b from-indigo-950 to-slate-900 border-indigo-500/50 text-indigo-200 shadow-lg shadow-indigo-950/50"
                              : "border-transparent bg-slate-950/40"
                            }`}
                        >
                          <div className={`font-black text-sm ${isSaturday ? "text-blue-400" : isSunday ? "text-rose-400" : "text-slate-200"}`}>
                            {day.label}
                          </div>
                          <div className={`text-[10px] font-black mt-0.5 ${isToday ? "text-cyan-400" : "text-slate-500"}`}>
                            ({day.dayOfWeek})
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 時間ごとのデータ行ブロック */}
                  {times.map((time) => {
                    const startHour = parseInt(time.label);
                    return (
                      <div key={time.label} className="grid grid-cols-8 gap-2.5 mb-2.5 text-center items-center">
                        {/* 左端の時間軸固定コマ */}
                        <div className="sticky left-0 z-10 text-slate-400 font-black flex items-center justify-center h-full text-xs border border-slate-800 rounded-2xl py-3 bg-gradient-to-r from-slate-950 to-slate-900">
                          {startHour}:00
                        </div>

                        {/* 各曜日のマスカスタマイズ */}
                        {days.map((day) => {
                          const slotId = `${time.label} ${day.compareFormat}`; // 裏データキーには西暦を含める
                          const isWeekend = day.dayOfWeek === "日" || day.dayOfWeek === "土";
                          const isClassTime = time.label >= "10:00" && time.label < "18:00"; // 平日10-18時は一律授業で禁止
                          const bookingData = bookedSlots.find(b => b.slotId === slotId);

                          const universityStatus = checkDisabledStatus(day.compareFormat, time.label);
                          const isSystemDisabled = (!isWeekend && isClassTime) || universityStatus.isDisabled;

                          // 過去の時間枠を自動で予約禁止（グレーアウト）にする判定
                          const slotDate = new Date(day.dateObj);
                          slotDate.setHours(startHour, 0, 0, 0);
                          const isPast = slotDate < today;
                          const isDisabled = isSystemDisabled || isPast;

                          return (
                            <button
                              key={`${time.label}-${day.label}`}
                              className={`rounded-2xl py-3 transition-all font-bold text-xs min-h-15 flex flex-col items-center justify-center border active:scale-[0.97] px-1 shadow-sm duration-150
                                ${isDisabled
                                  ? "border-slate-950 bg-slate-950/40 text-slate-700 cursor-not-allowed"
                                  : bookingData
                                    ? "border-indigo-500/30 bg-indigo-950/40 text-indigo-100 hover:bg-rose-950/50 hover:text-rose-400 hover:border-rose-500/50 cursor-pointer shadow-inner"
                                    : "border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:border-cyan-500 hover:-translate-y-0.5 shadow-md cursor-pointer"}`}
                              disabled={isDisabled}
                              onClick={() => {
                                setUserName(bookingData ? bookingData.userName : "");
                                setStudentId(bookingData ? String(bookingData.studentId) : "");
                                setCancelInputId("");
                                setSelectedSlot(slotId)
                              }}
                            >
                              {universityStatus.isDisabled ? (
                                <span className="text-[10px] text-rose-400 font-black tracking-tight leading-tight line-clamp-2 px-0.5">
                                  {universityStatus.reason}
                                </span>
                              ) : isSystemDisabled ? <span className="text-slate-700 font-normal text-xs">✕</span>
                                : isPast ? <span className="text-[10px] text-slate-700 font-normal">終了</span>
                                  : bookingData ? (
                                    <div className="w-full truncate">
                                      <div className="text-xs font-black tracking-tight text-indigo-300">{bookingData.userName}</div>
                                      <div className="text-[9px] text-indigo-500 font-bold tracking-tight mt-0.5">{bookingData.studentId}</div>
                                    </div>
                                  ) : <span className="text-slate-600 font-bold group-hover:text-slate-400 text-sm">+</span>}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>


              {/* ===============================================================
               * 📱 スマホ専用レイアウト (縦型タイムライン ＋ 親指操作ヘッダー)
               * =============================================================== */}
              <div className="md:hidden space-y-3">

                {/* 💡 改善ポイント：スクロールしても画面最上部に残り続ける「日付ヘッダー」 */}
                <div className="sticky top-0 z-30 bg-slate-900/95 border-b border-slate-800 pb-3 mb-2 shadow-2xl backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">表示中のスケジュール</span>
                    <span className={`text-lg font-black ${days[activeMobileDayIdx].dayOfWeek === "土" ? "text-blue-400" : days[activeMobileDayIdx].dayOfWeek === "日" ? "text-rose-400" : "text-cyan-400"}`}>
                      📅 {days[activeMobileDayIdx].label} ({days[activeMobileDayIdx].dayOfWeek})
                    </span>
                  </div>
                  <span className="text-xs font-black bg-slate-950 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-800">
                    {getWeekLabel()}
                  </span>
                </div>

                {/* 時間軸ボタンの縦並びコンテナ (余白での全体スクロールを阻害しない絶妙な高さに調整) */}
                <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
                  {times.map((time) => {
                    const startHour = parseInt(time.label);
                    const day = days[activeMobileDayIdx];
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

                    return (
                      <div key={time.label} className="flex items-center gap-3">
                        {/* 左側の時間表示 */}
                        <div className="w-14 text-center font-black text-sm text-slate-500">{time.label}</div>

                        {/* メイン予約枠ボタン */}
                        <button
                          className={`flex-1 rounded-2xl py-3.5 px-4 text-left transition-all font-bold text-sm min-h-14 border flex items-center justify-between active:scale-[0.98] duration-100
                            ${isDisabled
                              ? "border-slate-950 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                              : bookingData
                                ? "border-indigo-500/30 bg-indigo-950/40 text-indigo-100 shadow-inner"
                                : "border-slate-800 bg-slate-950 text-slate-300 shadow-sm"}`}
                          disabled={isDisabled}
                          onClick={() => {
                            setUserName(bookingData ? bookingData.userName : "");
                            setStudentId(bookingData ? String(bookingData.studentId) : "");
                            setCancelInputId("");
                            setSelectedSlot(slotId)
                          }}
                        >
                          {universityStatus.isDisabled ? (
                            <span className="text-xs text-rose-400 font-black flex items-center gap-1">
                              🚫 <span className="bg-rose-950/50 border border-rose-900/30 px-2 py-0.5 rounded-xl">{universityStatus.reason}</span>
                            </span>
                          ) : isSystemDisabled ? <span className="text-slate-600 font-normal text-xs">✕ 授業等のため貸切不可</span>
                            : isPast ? <span className="text-xs text-slate-600 font-normal">🕒 利用時間終了</span>
                              : bookingData ? (
                                <div className="flex justify-between items-center w-full">
                                  <span className="font-black text-slate-100">👤 {bookingData.userName}</span>
                                  <span className="text-[10px] text-indigo-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg font-mono font-bold">{bookingData.studentId}</span>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center w-full text-slate-500">
                                  <span className="text-xs font-medium">🟢 空き（タップして予約可能）</span>
                                  <span className="text-base font-bold text-slate-600">+</span>
                                </div>
                              )}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* 💡 改善ポイント：親指が余裕で届く「画面下部」に一括集約した操作パネル */}
                <div className="border-t border-slate-800 pt-3 mt-2 bg-slate-950/60 p-3 rounded-2xl shadow-inner">

                  {/* 横スクロール型の曜日選択ミニタブ */}
                  <div className="flex gap-1.5 overflow-x-auto pb-2.5 scrollbar-none snap-x">
                    {days.map((day, idx) => {
                      const isSelected = activeMobileDayIdx === idx;
                      const isToday = day.label === todayString && dayOffset === 0;
                      // 土日の色付け
                      const isSaturday = day.dayOfWeek === "土";
                      const isSunday = day.dayOfWeek === "日";

                      return (
                        <button
                          key={day.label}
                          onClick={() => setActiveMobileDayIdx(idx)}
                          className={`snap-center shrink-0 min-w-[68px] py-2 px-1 rounded-xl border text-center transition-all duration-100 active:scale-95 ${isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white font-black shadow-lg shadow-indigo-950"
                              : isToday
                                ? "bg-slate-900 border-indigo-500/40 text-indigo-300 font-bold"
                                : "bg-slate-900/40 border-slate-800 text-slate-400"
                            }`}
                        >
                          <div className={`text-xs font-black ${isSelected ? "text-white" : isSaturday ? "text-blue-400" : isSunday ? "text-rose-400" : "text-slate-300"}`}>
                            {day.label}
                          </div>
                          <div className={`text-[9px] ${isSelected ? "text-indigo-200" : "text-slate-500"}`}>({day.dayOfWeek})</div>
                        </button>
                      )
                    })}
                  </div>

                  {/* 週切り替え用の前へ/次へボタン（親指直撃位置） */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={() => handleWeekChange(dayOffset - 7)} className="bg-slate-900 text-slate-300 border border-slate-800 font-black py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-md">← 前の週</button>
                    <button onClick={() => handleWeekChange(dayOffset + 7)} className="bg-slate-900 text-slate-300 border border-slate-800 font-black py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-md">次の週 →</button>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* ===============================================================
         * 6. ポップアップモーダルエリア (新規予約登録 / キャンセル確認)
         * =============================================================== */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-800 transform scale-100 animate-in zoom-in-95 duration-150">

              {/* Aパターン：すでに予約が入っているコマをタップした場合（予約取消モード） */}
              {currentModalBooking ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-rose-950/50 text-rose-400 border border-rose-800/30 flex items-center justify-center text-xl mb-4">⚠️</div>
                  <h2 className="text-xl font-black text-slate-100 mb-1">予約の解除</h2>
                  <p className="text-slate-400 text-xs mb-4">選択枠：<span className="font-black text-cyan-400">{selectedSlot.split(" ")[0]} ({selectedSlot.split(" ")[1]})</span></p>

                  <div className="mb-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center shadow-inner">
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">現在の予約代表者</span>
                    <span className="text-base font-black text-slate-200">{userName} さん</span>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-black text-slate-400 mb-1.5 pl-1 text-left">本人確認のため学籍番号(7桁)を入力</label>
                    {/* 💡 ズームバグを防止する text-base */}
                    <input
                      type="number"
                      placeholder="学籍番号を入力"
                      value={cancelInputId}
                      onChange={(e) => setCancelInputId(e.target.value)}
                      className="border border-slate-800 p-3 rounded-2xl w-full text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-950 text-slate-100"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={!isCancelValid || isSubmitting}
                      className={`w-full text-white font-black py-3 rounded-2xl text-sm transition-all shadow-lg active:scale-95 duration-100 cursor-pointer
                        ${isCancelValid && !isSubmitting ? "bg-rose-600 hover:bg-rose-500 shadow-rose-950" : "bg-slate-800 text-slate-500 border border-slate-800/50 cursor-not-allowed shadow-none"}`}
                    >
                      {isSubmitting ? "データを通信中..." : "この予約を取り消す"}
                    </button>
                    <button onClick={() => setSelectedSlot(null)} disabled={isSubmitting} className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 font-black py-3 rounded-2xl text-sm transition-colors cursor-pointer">閉じる</button>
                  </div>
                </>
              ) : (
                // Bパターン：空いているコマをタップした場合（新規予約登録モード）
                <>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-950/50 text-indigo-400 border border-indigo-800/30 flex items-center justify-center text-xl mb-4">📝</div>
                  <h2 className="text-xl font-black text-slate-100 mb-1">スタジオ予約の登録</h2>
                  <p className="text-slate-400 text-xs mb-5">選択枠：<span className="font-black text-cyan-400">{selectedSlot.split(" ")[0]} ({selectedSlot.split(" ")[1]})</span></p>

                  <div className="space-y-4 text-left mb-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 pl-1">利用代表者名</label>
                      {/* 💡 ズームバグを防止する text-base */}
                      <input type="text" placeholder="名前を入力" value={userName} disabled={isSubmitting} onChange={(e) => setUserName(e.target.value)} className="border border-slate-800 p-3 rounded-2xl w-full text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-950 text-slate-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 pl-1">
                        学籍番号 <span className={`text-[10px] font-black ${isStudentIdValid ? "text-emerald-400" : "text-slate-500"}`}>(7桁の数字)</span>
                      </label>
                      {/* 💡 ズームバグを防止する text-base */}
                      <input type="number" placeholder="7桁の数字を入力" value={studentId} disabled={isSubmitting} onChange={(e) => setStudentId(e.target.value)} className="border border-slate-800 p-3 rounded-2xl w-full text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-950 text-slate-100" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button onClick={handleBook} disabled={!isFormValid || isSubmitting} className={`w-full font-black py-3 rounded-2xl transition-all shadow-lg text-sm active:scale-95 duration-100 cursor-pointer ${isFormValid && !isSubmitting ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950" : "bg-slate-800 text-slate-500 border border-slate-800/50 cursor-not-allowed shadow-none"}`}>
                      {isSubmitting ? "予約データを書き込み中..." : "この内容で予約を確定する"}
                    </button>
                    <button onClick={() => { setSelectedSlot(null); setUserName(""); setStudentId(""); }} disabled={isSubmitting} className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 font-black py-3 rounded-2xl text-sm transition-colors cursor-pointer">キャンセル</button>
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

// ハイドレーションエラー（サーバーとクライアントの描画ズレ）を防止するためのDynamicインポート設定
export default dynamic(() => Promise.resolve(ReservationPage), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-black tracking-wider text-xs">
      INITIALIZING ROCK DASHBOARD...
    </div>
  )
})