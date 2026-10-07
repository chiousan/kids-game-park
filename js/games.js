/* 遊戲清單：首頁與遊戲頁共用（圖示在 assets/icons/<id>.png） */
window.GG = window.GG || {};

GG.CATS = [
  { id: 'all', name: '全部', color: '#ffffff' },
  { id: 'puzzle', name: '益智動腦', color: '#ffc93c' },
  { id: 'action', name: '動作反應', color: '#ff6b6b' },
  { id: 'sport', name: '競速運動', color: '#4dd4e8' },
  { id: 'duo', name: '雙人對戰', color: '#b388ff' }
];

GG.GAMES = [
  { id: 'dino', ctrl: 'stick', name: '恐龍世界', cat: 'action', c1: '#7fd36b', c2: '#2e8b57',
    desc: '從寶寶長大成首領', how: '選一隻恐龍，用搖桿在小島上走路。按「吃」吃東西、在水池邊按「喝」喝水，吃飽喝足就會長大升一關！小心肉食恐龍，按紅色鈕保護自己，打不過就躲回恐龍巢。' },
  { id: 'g2048', ctrl: 'swipe', name: '2048', cat: 'puzzle', c1: '#ffb547', c2: '#ff7a3d',
    desc: '滑動合併數字', how: '往上下左右滑動，一樣的數字碰在一起就會合併。挑戰合出 2048！' },
  { id: 'gems', ctrl: 'swipe', name: '寶石消消樂', cat: 'puzzle', c1: '#b06cff', c2: '#6a5cff',
    desc: '三個一樣就消除', how: '把寶石往旁邊滑，讓 3 顆以上一樣的寶石排成一排就會消除。時間到之前拿最多分！' },
  { id: 'blocks', ctrl: 'dpad', name: '方塊堆疊', cat: 'puzzle', c1: '#4fc3f7', c2: '#2979ff',
    desc: '排滿一行就消除', how: '用十字鍵：← → 移動、↑ 旋轉、↓ 加速，按「落下」直接掉到底。排滿一整行就會消除！' },
  { id: 'memory', ctrl: 'tap', name: '動物翻翻樂', cat: 'puzzle', c1: '#ff8fb1', c2: '#ff5c8a', lower: true, unit: ' 步',
    desc: '找出一樣的動物', how: '翻開兩張牌，一樣的動物就配對成功。用越少步數完成越厲害！' },
  { id: 'mines', ctrl: 'tap', name: '踩地雷', cat: 'puzzle', c1: '#9ccc65', c2: '#43a047', lower: true, unit: ' 秒',
    desc: '找出所有安全格', how: '點格子打開，數字代表周圍有幾顆炸彈。長按格子或切換成「插旗模式」可以插旗。' },
  { id: 'snake', ctrl: 'stick', name: '貪食蛇', cat: 'action', c1: '#66e08a', c2: '#1fae5b',
    desc: '吃寶石變長長', how: '用搖桿控制小蛇轉彎（也可以在畫面上滑動），吃寶石會變長，不要咬到自己！' },
  { id: 'breakout', ctrl: 'drag', name: '打磚塊', cat: 'action', c1: '#ff9a6b', c2: '#ff5252',
    desc: '彈球打碎磚塊', how: '手指左右拖曳移動板子，把球彈回去打碎所有磚塊。點一下發球！' },
  { id: 'runner', ctrl: 'tap', name: '跳跳大冒險', cat: 'action', c1: '#ffd54f', c2: '#ffa000',
    desc: '跳過怪物收金幣', how: '點畫面跳躍，在空中再點一次可以二段跳。跳過怪物和障礙、收集金幣！' },
  { id: 'space', ctrl: 'drag', name: '太空射擊', cat: 'action', c1: '#7c8cff', c2: '#3d2c8d',
    desc: '打倒外星飛船', how: '手指拖曳移動太空船，會自動發射。撿彩色寶石換武器，同顏色連續撿會升級，最高 5 級！' },
  { id: 'racer', ctrl: 'drag', name: '公路賽車', cat: 'sport', c1: '#ff6b6b', c2: '#c92a2a',
    desc: '閃過路上車輛', how: '手指左右拖曳開車，閃過其他車輛和三角錐、吃金幣。開越遠分數越高！' },
  { id: 'hoops', ctrl: 'aim', name: '投籃高手', cat: 'sport', c1: '#ffa94d', c2: '#e8590c',
    desc: '拉弓投籃得分', how: '手指往後拉再放開就會投籃，像彈弓一樣。時間內投進越多球越好！' },
  { id: 'penalty', ctrl: 'flick', name: '點球大戰', cat: 'sport', c1: '#69db7c', c2: '#2b8a3e',
    desc: '射門騙過守門員', how: '從球往球門方向滑動來射門，滑到角落最難擋！一共 10 球。' },
  { id: 'hockey', ctrl: 'drag', name: '桌上冰球', cat: 'duo', c1: '#4dd4e8', c2: '#1c7ed6',
    desc: '兩人面對面對打', how: '用手指拖曳自己的球拍，把冰球打進對方球門。先得 5 分獲勝！' },
  { id: 'gomoku', ctrl: 'tap', name: '五子棋', cat: 'duo', c1: '#d9a066', c2: '#8d5a2b',
    desc: '先連成五顆贏', how: '輪流下棋，橫、直、斜任一方向先連成 5 顆的人獲勝！' },
  { id: 'tanks', ctrl: 'stick', name: '坦克對戰', cat: 'duo', c1: '#a3b86c', c2: '#5c6f2b',
    desc: '雙人坦克大戰', how: '用搖桿開坦克、按圓形開砲鈕發射。砲彈碰到牆會反彈一次，先打倒對手 3 次獲勝！' },
  { id: 'whack', ctrl: 'tap', name: '敲敲圓滾滾', cat: 'action', c1: '#a0e060', c2: '#4f9a25',
    desc: '敲冒出來的小怪', how: '圓滾滾從洞裡冒出來就快點敲！金色的分數更高，看到炸彈千萬別敲喔。' },
  { id: 'flappy', ctrl: 'tap', name: '飛飛小飛機', cat: 'action', c1: '#7fd3ff', c2: '#2f8fd8',
    desc: '點一下往上飛', how: '點畫面讓小飛機往上飛，穿過岩石中間的空隙、收集星星。有 3 顆愛心可以用！' },
  { id: 'bubble', ctrl: 'aim', name: '泡泡龍', cat: 'puzzle', c1: '#ff9be0', c2: '#b05cff',
    desc: '三個同色就爆破', how: '手指按住瞄準、放開發射泡泡，3 顆以上同顏色連在一起就會爆破。把泡泡全部清光！' },
  { id: 'jumper', ctrl: 'stick', name: '跳跳兔', cat: 'action', c1: '#ffd6a5', c2: '#ff8fab',
    desc: '一直往上跳', how: '用搖桿讓兔兔左右移動，踩著雲台一直往上跳！彈簧可以跳更高喔。' },
  { id: 'fishing', ctrl: 'tap', name: '釣魚樂', cat: 'sport', c1: '#4fd1e8', c2: '#1a6fb5',
    desc: '點哪裡就釣哪裡', how: '點水裡的魚，小船會開過去放下魚鉤。越大的魚分數越高，河豚會扣分喔！' },
  { id: 'stairs', ctrl: 'lr', name: '小朋友下樓梯', cat: 'action', c1: '#b9a6ff', c2: '#6a4ce0', players: '1–4 人',
    desc: '一路往下走', how: '按自己顏色的 ← → 鍵移動，站在樓梯上一直往下走，別碰到天花板的尖刺、小心尖刺樓梯！1～4 人一起玩，最後還活著的人贏。' },
  { id: 'connect4', ctrl: 'tap', name: '四子棋', cat: 'duo', c1: '#ffd166', c2: '#ef8a17',
    desc: '先連成四顆贏', how: '輪流點一行投下棋子，橫、直、斜先連成 4 顆的人獲勝！' }
];

GG.findGame = function (id) {
  for (var i = 0; i < GG.GAMES.length; i++) if (GG.GAMES[i].id === id) return GG.GAMES[i];
  return null;
};
