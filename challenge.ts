interface Record {
    date: string;    // 日付
    memo: string;    // 何に使ったか
    amount: number;  // 金額
    category: "food" | "hobby" | "other"; // カテゴリ（これ、C言語にはない便利な書き方です！）
}

const history: Record[] = [
    {date: "2026-05-12", memo: "外食", amount: 1000, category: "food"},
    {date: "2026-04-12", memo: "本", amount: 800, category: "hobby"},
    {date: "2026-05-07", memo: "飲み会", amount: 1500, category: "food"},
    {date: "2026-05-1", memo: "旅行", amount: 4000, category: "other"},
];

let sum:number = 0;

for(const i of history){
    sum += i.amount;
}
// console.log(`合計支出：${sum}円`);

// const foodhistory = history.filter(n => n.category == "food");
// console.log(foodhistory);

// const viewhistory = history.map(n => `[${n.date}] ${n.memo} (${n.amount}円)`);
// console.log(viewhistory);

const namehistory = history.filter(n => n.amount >= 1000).map(n => n.memo);
console.log(namehistory);
let foodsum: number = 0;
const foodhistory = history.filter(n => n.category == "food");
for(const i of foodhistory){
    foodsum += i.amount;
}
const foodSum = history.filter(n => n.category == "food").reduce((sum, n) => sum + n.amount,0);
console.log(foodsum);
console.log(foodSum);

const sorthistory = history.sort((a,b) => b.amount - a.amount);
console.log(sorthistory);