// WATCHPACK_POLLING=true npx next dev --webpack
"use client"; // 「これはブラウザで動く部品だよ」という合図
import { useState } from 'react'; // 「Stateを使うよ」という合図

export default function Home(){
  const [count, setCount] = useState(0);
  return (
    <div style = {{padding:"20px"}}>
      <h1>Reactの勉強スタート！</h1>
      <p>この文字が見えたら成功です。</p>
    </div>
  )
}