"use client"

import React from "react"

interface ModalsProps {
    // 一括予約モーダル用
    isBookModalOpen: boolean;
    setIsBookModalOpen: (open: boolean) => void;
    getSortedSelectedLabels: () => string;
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
    cancelInputId: string;
    setCancelInputId: (id: string) => void;
    isCancelValid: boolean;
    handleCancelSubmit: () => Promise<void>;
}

export function Modals({
    isBookModalOpen,
    setIsBookModalOpen,
    getSortedSelectedLabels,
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
    cancelInputId,
    setCancelInputId,
    isCancelValid,
    handleCancelSubmit
}: ModalsProps) {
    return (
        <>
            {/* 1. 一括予約登録モーダル */}
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
                                {/* inputMode="text" で数字入力後でも確実に日本語入力を開く */}
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
                                {/* ▲▼の矢印を完全に排除したスタイリング */}
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
                                {isSubmitting ? "連続書き込み中..." : "まとめて予約を確定する"}
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
                        <div className="w-10 h-10 rounded-xl bg-rose-950/50 text-rose-400 border border-rose-800/20 flex items-center justify-center text-sm font-black mb-4">✕</div>
                        <h2 className="text-xl font-black text-slate-100 mb-1">予約の解除</h2>
                        <p className="text-slate-400 text-xs mb-4">選択枠：<span className="font-bold text-cyan-400 font-mono">{cancelTargetSlot.split(" ")[0]} ({cancelTargetSlot.split(" ")[1].split("/")[1]}/{cancelTargetSlot.split(" ")[1].split("/")[2]})</span></p>

                        <div className="mb-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center shadow-inner">
                            <span className="block text-[9px] font-black text-slate-600 tracking-wider mb-1">現在の予約代表者</span>
                            <span className="text-sm font-black text-slate-300 truncate block px-2">{currentCancelBooking.userName} さん</span>
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
        </>
    );
}