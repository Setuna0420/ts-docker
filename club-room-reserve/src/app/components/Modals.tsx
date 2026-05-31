"use client"

import React from "react"

interface ModalsProps {
    // 一括予約モーダル用
    isBookModalOpen: boolean;
    setIsBookModalOpen: (open: boolean) => void;
    selectedSlots: string[];
    setSelectedSlots: (slots: string[]) => void;
    userName: string;
    setUserName: (name: string) => void;
    studentId: string;
    setStudentId: (id: string) => void;
    isFormValid: boolean;
    isSubmitting: boolean;
    handleBookSubmit: () => Promise<void>;

    // キャンセルモーダル用
    cancelTargetSlot: string | null;
    setCancelTargetSlot: (slot: string | null) => void;
    currentCancelBooking: { userName: string; studentId: number } | undefined;
    handleCancelSubmit: () => Promise<void>;
    isSubmittingCancel: boolean;
}

export function Modals({
    isBookModalOpen,
    setIsBookModalOpen,
    selectedSlots,
    setSelectedSlots,
    userName,
    setUserName,
    studentId,
    setStudentId,
    isFormValid,
    isSubmitting,
    handleBookSubmit,
    cancelTargetSlot,
    setCancelTargetSlot,
    currentCancelBooking,
    handleCancelSubmit,
    isSubmittingCancel
}: ModalsProps) {

    // スロット名を見やすく整形するヘルパー
    const formatSlotLabel = (slotId: string) => {
        const [timePart, datePart] = slotId.split(" ");
        const [, month, day] = datePart.split("/");
        return `${parseInt(month, 10)}/${parseInt(day, 10)} ${timePart}`;
    };

    // 予約モーダル内で特定のコマだけをピンポイントで外す処理
    const handleRemoveSlotInModal = (slotId: string) => {
        const updated = selectedSlots.filter(id => id !== slotId);
        setSelectedSlots(updated);
        if (updated.length === 0) {
            setIsBookModalOpen(false);
        }
    };

    return (
        <>
            {/* 1. 一括予約登録モーダル */}
            {isBookModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
                    <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-800 transform scale-100 animate-in zoom-in-95 duration-100">
                        <h2 className="text-xl font-black text-slate-100 mb-3">スタジオ予約の登録</h2>

                        <div className="mb-4 text-left">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 pl-1">選択中のコマ（タップで解除）</label>
                            <div className="flex flex-wrap gap-1.5">
                                {[...selectedSlots].map((slotId) => (
                                    <button
                                        key={slotId}
                                        onClick={() => handleRemoveSlotInModal(slotId)}
                                        disabled={isSubmitting}
                                        className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900/40 text-cyan-400 font-mono text-[11px] font-bold px-3 py-1.5 rounded-xl border border-slate-800 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span>{formatSlotLabel(slotId)}</span>
                                        <span className="text-[10px] text-slate-500 font-sans">✕</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 text-left mb-6">
                            <div>
                                <div className="flex justify-between items-center mb-1.5 pl-1">
                                    <label className="block text-[11px] font-black text-slate-400">利用代表者名</label>
                                    <span className={`text-[10px] font-black ${userName.trim().length > 10 ? "text-rose-400 animate-pulse" : "text-slate-600"}`}>
                                        {userName.trim().length}/10文字
                                    </span>
                                </div>
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
                                <label className="block text-[11px] font-black text-slate-400 mb-1.5 pl-1">学籍番号 <span className={`text-[10px] font-black ${/^[0-9]{7}$/.test(studentId.trim()) ? "text-emerald-400" : "text-slate-600"}`}>(7桁の数字)</span></label>
                                <input
                                    type="number"
                                    placeholder="7桁の数字を入力"
                                    value={studentId}
                                    disabled={isSubmitting}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="border border-slate-800 p-3 rounded-2xl w-full text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-950 text-slate-100 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
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
                                {isSubmitting ? "連続書き込み中..." : "予約を確定する"}
                            </button>
                            <button onClick={() => setIsBookModalOpen(false)} disabled={isSubmitting} className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 font-black py-3 rounded-2xl text-xs transition-colors cursor-pointer">戻る</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. 予約の解除用モーダル */}
            {cancelTargetSlot && currentCancelBooking && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
                    <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-800 transform scale-100 animate-in zoom-in-95 duration-100">
                        <h2 className="text-xl font-black text-slate-100 mb-1">予約の解除確認</h2>
                        <p className="text-slate-400 text-xs mb-5">対象の枠：<span className="font-bold text-rose-400 font-mono">{formatSlotLabel(cancelTargetSlot)}</span></p>

                        <div className="mb-6 bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center shadow-inner">
                            <span className="block text-[9px] font-black text-slate-600 tracking-wider mb-1.5 uppercase">RESERVATION HOLDER</span>
                            <div className="text-base font-black text-slate-200 truncate px-2">{currentCancelBooking.userName} さん</div>
                            <div className="text-[11px] font-mono font-bold text-slate-500 mt-1">学籍番号: {currentCancelBooking.studentId}</div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {/* 💡 内側のバグっていたSVGを綺麗に修正し、通信中は赤い影が100%消えるプロ仕様に！ */}
                            <button
                                onClick={handleCancelSubmit}
                                disabled={isSubmittingCancel}
                                className="w-full text-white font-black py-3 rounded-2xl text-xs tracking-wider transition-all shadow-md active:scale-[0.98] duration-100 bg-rose-600 hover:bg-rose-500 shadow-rose-950 cursor-pointer flex items-center justify-center gap-2 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                {isSubmittingCancel ? "削除データを送信中..." : "この予約を取り消す"}
                            </button>
                            <button onClick={() => setCancelTargetSlot(null)} disabled={isSubmittingCancel} className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 font-black py-3 rounded-2xl text-xs transition-colors cursor-pointer">閉じる</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}