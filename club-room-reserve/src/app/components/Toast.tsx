"use client"

import React from "react"

export interface ToastType {
    id: number;
    message: string;
    type: "success" | "error";
}

interface ToastProps {
    toasts: ToastType[];
}

export function Toast({ toasts }: ToastProps) {
    return (
        /* 💡 【スマホでのズレ・はみ出しを完全修正】
           スマホ（初期状態）: `top-4 left-4 right-4` で画面の左右いっぱいに安全な余白（16px）を空けてフィット。 `w-auto` で横幅を自動調整。
           PC（md以上）      : `md:top-6 md:right-6 md:left-auto` で元のスタイリッシュな右上にピタッと戻します。 `md:w-full md:max-w-sm` で横幅を制限。 */
        <div className="fixed top-4 left-4 right-4 md:top-6 md:right-6 md:left-auto z-50 flex flex-col gap-3 w-auto md:w-full md:max-w-sm pointer-events-none">
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
    );
}