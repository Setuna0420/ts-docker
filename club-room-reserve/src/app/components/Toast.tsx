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
    );
}