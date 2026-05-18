// 問題：長方形の面積を計算する関数を作ろう

// 1. 関数の引数と戻り値に「型」を書いてください
// C言語の double area(double width, double height) と同じイメージです
// const getRectangleArea = (width: number, height: number): number => {
//     return width * height;
// }

// // 2. 変数を宣言して、関数を呼び出してみよう
// // ここには「10.5」という数値を入れてください
// const w: number = 10.5; 
// const h: number = 20;

// const result = getRectangleArea(w, h);

// // 3. 結果を表示しよう
// console.log(`面積は ${result} です`);

// const sayHello=(name: string): void=>{
//     console.log("こんにちは、"+ name + "さん！");
// }
// sayHello("ダイヤ")

// const score: number = 60;

// if(score >= 80){
//     console.log("合格です！素晴らしい。");
// }else{
//     console.log("次は頑張りましょう。");
// }

// for (let i: number = 0; i < 5; i++){
//     console.log(`${i} 回目のループです`);
// }

// const friuts: string[] = ["リンゴ","バナナ","ミカン"];
// // for (let i: number = 0; i < friuts.length; i++){
// //     console.log(`今日のデザートは${friuts[i]}`);
// // }

// const friuts: string[] = ["リンゴ","バナナ","ミカン"];
// for (const fruit of friuts){
//     console.log(`今日のデザートは ${fruit}`);
// }

// interface User {
//     id: number;
//     name: string;
//     age: number
// }

// const user1: User= {
//     id: 1,
//     name: "ダイヤ",
//     age: 20
// };

// console.log(`${user1.name}さんのIDは ${user1.id}です。`)

// const profile=(user: User)=>{
//     console.log(`名前: ${user.name} (${user.age}歳)`)
// }
// profile(user1);

// const users: User[]=[
//     {id: 1, name: "ダイヤ", age:20},
//     {id: 2, name: "田中", age:25},
//     {id: 3, name: "佐藤", age:30}
// ];

// for(const u of users){
//     console.log(`${u.name}さんは現在 ${u.age}歳です。`)
// }

// interface item{
//     name: string,
//     price: number,
//     isSale: boolean
// };

// 【問1】「Book」という名前のインターフェースを作ってください
// 項目：title(文字列), price(数値), isEbook(真偽値)
// interface Book {
//     title: string;
//     price: number;
//     isEbook: boolean;
// }

// // 【問2】Book型の配列を作ってください
// // 1冊目は「C言語入門」、2冊目は「TypeScriptの基礎」
// const library: Book[] = [
//     {
//         title: "C言語入門",
//         price: 2500,
//         isEbook: false
//     },
//     {
//         title: "TypeScriptの基礎",
//         price: 3000,
//         isEbook: true
//     }
// ];

// // 【問3】電子書籍（isEbookがtrue）の本だけを表示するループを完成させてください
// console.log("--- 電子書籍一覧 ---");
// for (const b of library) {
//     if (b.isEbook === true) {
//         console.log(`電子書籍で読めます: ${b.title}`);
//     }
// }

// interface Smartphone{
//     model: string,
//     storage: number,
//     is5G: boolean
// };

// const phone: Smartphone={
//     model: "Iphone",
//     storage: 256,
//     is5G: true
// };
// console.log(`モデル名：${phone.model}、容量：${phone.storage}GB`);

// interface Product{
//     name: string;
//     stock: number;
// }

// const products: Product[]=[
//     {name: "ペン", stock: 10},
//     {name: "教科書", stock: 0},
//     {name: "ノート", stock: 5}
// ];

// for(const i of products){
//     if(i.stock>0){
//         console.log(i.name);
//     }
// }

// interface Rectangle {
//     width: number;
//     height: number;
// }

// const rect: Rectangle={
//     width: 10,
//     height: 20
// };

// const calculation = (rectangle: Rectangle): number =>{
//     return rectangle.width * rectangle.height
// };

// console.log(calculation(rect));

// interface Item{
//     name: string;
//     price: number;
// }

// const shop: Item[]=[
//     {name: "リンゴ", price: 1500},
//     {name: "バナナ", price: 1000},
//     {name: "ミカン", price: 600},
//     {name: "ブドウ", price: 2000},
//     {name: "メロン", price: 900}
// ];

// const expensiveItem = shop.filter(n => n.price > 1000);
// console.log(expensiveItem);

// const displayNames = shop.map(n => "おすすめ"+ n.name);
// console.log(displayNames);

// const newshop = shop.filter(n => n.price>1000).map(n => "高級："+ n.name);
// console.log(newshop);

interface User{
    id: number;
    name: string;
    email:string;
}

const user:User={
    id:1,
    name: "yamada",
    email: "0123@"
}

const {name,email} = user;
console.log(`${name}は${email}です。`);


interface Item{
    name: string;
    price: number;
}

function printItem ({name,price}: Item){
    console.log(`${name}は${price}です`)
}

interface Setting{
    theme: string;
    fontSize?: number;
}

const config:Setting={
    theme: "aaa",
    
};

const {theme, fontSize = 16} = config; 
console.log(fontSize);