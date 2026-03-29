export interface FloorPlan {
  id: string;
  name: string;
  imageUrl: string;
  type: 'default' | 'uploaded';
  widthMeters?: number;
}

function generateSvg(type: number, widthMeters: number): string {
  const bg = '#8c8c8c'; // CAD Grey background
  const wall = '#262626'; // Dark thick walls
  const floor = '#f5f5f5'; // White floors
  const bathFloor = '#e0f2fe'; // Light blue for bathrooms
  const textFill = '#525252';
  const grid = '#a3a3a3';
  const furniture = '#d4d4d4';
  const dimLine = '#404040';
  const dimText = '#171717';
  
  const defs = `
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${grid}" stroke-width="0.5"/>
      </pattern>
      <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.3" />
      </filter>
    </defs>
  `;

  const dimLength = Math.round(widthMeters * 1000); // mm

  let content = '';
  switch(type) {
    case 1: // Custom Default Floor Plan (3B2B)
      content = `
        <rect x="50" y="50" width="700" height="500" fill="${floor}" filter="url(#drop-shadow)"/>
        
        <!-- Bathrooms -->
        <rect x="250" y="50" width="150" height="150" fill="${bathFloor}"/>
        <rect x="420" y="100" width="100" height="100" fill="${bathFloor}"/>
        
        <!-- Outer Walls -->
        <path d="M50,50 L400,50 L400,100 L750,100 L750,400 L600,400 L600,500 L100,500 L100,350 L50,350 Z" fill="none" stroke="${wall}" stroke-width="10" stroke-linecap="square"/>
        
        <!-- Inner Walls -->
        <path d="M250,50 L250,200 L400,200 M400,100 L400,200 M420,100 L420,200 L520,200 L520,100 M520,250 L750,250 M520,250 L520,400 L750,400 M100,200 L250,200 M100,350 L300,350 M300,350 L300,500 M450,400 L450,500 M600,400 L600,500 M600,450 L750,450" fill="none" stroke="${wall}" stroke-width="8" stroke-linecap="square"/>
        
        <!-- Doors (White gaps over walls) -->
        <line x1="230" y1="200" x2="270" y2="200" stroke="${floor}" stroke-width="12"/>
        <line x1="380" y1="200" x2="420" y2="200" stroke="${floor}" stroke-width="12"/>
        <line x1="400" y1="180" x2="400" y2="220" stroke="${floor}" stroke-width="12"/>
        <line x1="520" y1="230" x2="520" y2="270" stroke="${floor}" stroke-width="12"/>
        <line x1="280" y1="350" x2="320" y2="350" stroke="${floor}" stroke-width="12"/>
        <line x1="600" y1="430" x2="600" y2="470" stroke="${floor}" stroke-width="12"/>
        
        <!-- Text Labels -->
        <text x="150" y="130" font-family="sans-serif" font-size="16" font-weight="bold" fill="${textFill}" text-anchor="middle">主卧</text>
        <text x="325" y="130" font-family="sans-serif" font-size="14" font-weight="bold" fill="${textFill}" text-anchor="middle">主卫</text>
        <text x="470" y="155" font-family="sans-serif" font-size="14" font-weight="bold" fill="${textFill}" text-anchor="middle">次卫</text>
        <text x="635" y="180" font-family="sans-serif" font-size="16" font-weight="bold" fill="${textFill}" text-anchor="middle">休闲区</text>
        <text x="175" y="280" font-family="sans-serif" font-size="16" font-weight="bold" fill="${textFill}" text-anchor="middle">次卧</text>
        <text x="410" y="330" font-family="sans-serif" font-size="16" font-weight="bold" fill="${textFill}" text-anchor="middle">餐厅</text>
        <text x="635" y="330" font-family="sans-serif" font-size="16" font-weight="bold" fill="${textFill}" text-anchor="middle">厨房</text>
        <text x="200" y="430" font-family="sans-serif" font-size="16" font-weight="bold" fill="${textFill}" text-anchor="middle">客厅</text>
        <text x="75" y="430" font-family="sans-serif" font-size="14" font-weight="bold" fill="${textFill}" text-anchor="middle">阳台</text>
        <text x="675" y="430" font-family="sans-serif" font-size="14" font-weight="bold" fill="${textFill}" text-anchor="middle">储物间</text>
        <text x="525" y="455" font-family="sans-serif" font-size="14" font-weight="bold" fill="${textFill}" text-anchor="middle">楼梯</text>
        
        <!-- Furniture Details -->
        <!-- Master Bed -->
        <rect x="70" y="70" width="100" height="100" fill="none" stroke="${furniture}" stroke-width="2"/>
        <!-- Second Bed -->
        <rect x="120" y="220" width="100" height="80" fill="none" stroke="${furniture}" stroke-width="2"/>
        <!-- Dining Table -->
        <rect x="380" y="280" width="60" height="100" fill="none" stroke="${furniture}" stroke-width="2" rx="10"/>
        <!-- Sofa -->
        <rect x="120" y="370" width="150" height="40" fill="none" stroke="${furniture}" stroke-width="2" rx="5"/>
        <rect x="120" y="470" width="150" height="20" fill="none" stroke="${furniture}" stroke-width="2"/>
        <!-- Kitchen Island/Counter -->
        <rect x="540" y="270" width="180" height="40" fill="none" stroke="${furniture}" stroke-width="2"/>
        <!-- Stairs lines -->
        <line x1="450" y1="420" x2="600" y2="420" stroke="${furniture}" stroke-width="1"/>
        <line x1="450" y1="440" x2="600" y2="440" stroke="${furniture}" stroke-width="1"/>
        <line x1="450" y1="460" x2="600" y2="460" stroke="${furniture}" stroke-width="1"/>
        <line x1="450" y1="480" x2="600" y2="480" stroke="${furniture}" stroke-width="1"/>
        
        <!-- Dimensions -->
        <line x1="50" y1="30" x2="750" y2="30" stroke="${dimLine}" stroke-width="1"/>
        <line x1="50" y1="20" x2="50" y2="40" stroke="${dimLine}" stroke-width="1"/>
        <line x1="750" y1="20" x2="750" y2="40" stroke="${dimLine}" stroke-width="1"/>
        <text x="400" y="25" font-family="monospace" font-size="14" fill="${dimText}" text-anchor="middle">${dimLength}</text>
      `;
      break;
    case 2: // 2B1B
      content = `
        <line x1="100" y1="50" x2="700" y2="50" stroke="${dimLine}" stroke-width="1"/>
        <line x1="100" y1="40" x2="100" y2="60" stroke="${dimLine}" stroke-width="1"/>
        <line x1="700" y1="40" x2="700" y2="60" stroke="${dimLine}" stroke-width="1"/>
        <text x="400" y="40" font-family="monospace" font-size="14" fill="${dimText}" text-anchor="middle">${dimLength}</text>

        <rect x="100" y="100" width="600" height="400" fill="${floor}" filter="url(#drop-shadow)"/>
        <rect x="100" y="400" width="200" height="100" fill="${bathFloor}"/>
        <path d="M100,100 L700,100 L700,500 L100,500 Z M300,100 L300,500 M100,250 L300,250 M100,400 L300,400" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        
        <!-- Doors -->
        <line x1="280" y1="180" x2="320" y2="180" stroke="${floor}" stroke-width="14"/>
        <line x1="280" y1="330" x2="320" y2="330" stroke="${floor}" stroke-width="14"/>
        <line x1="280" y1="450" x2="320" y2="450" stroke="${floor}" stroke-width="14"/>

        <!-- Bed 1 -->
        <rect x="120" y="120" width="140" height="100" fill="none" stroke="${furniture}" stroke-width="3"/>
        <!-- Bed 2 -->
        <rect x="120" y="270" width="100" height="100" fill="none" stroke="${furniture}" stroke-width="3"/>
        <!-- Dining -->
        <circle cx="500" cy="200" r="40" fill="none" stroke="${furniture}" stroke-width="3"/>
        <rect x="450" y="190" width="20" height="20" fill="none" stroke="${furniture}" stroke-width="2"/>
        <rect x="530" y="190" width="20" height="20" fill="none" stroke="${furniture}" stroke-width="2"/>
        <rect x="490" y="150" width="20" height="20" fill="none" stroke="${furniture}" stroke-width="2"/>
        <rect x="490" y="230" width="20" height="20" fill="none" stroke="${furniture}" stroke-width="2"/>
        
        <text x="200" y="190" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">主卧</text>
        <text x="200" y="340" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">次卧</text>
        <text x="200" y="460" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">卫</text>
        <text x="500" y="350" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">客餐厅</text>
      `;
      break;
    case 3: // 3B2B
      content = `
        <line x1="50" y1="30" x2="750" y2="30" stroke="${dimLine}" stroke-width="1"/>
        <line x1="50" y1="20" x2="50" y2="40" stroke="${dimLine}" stroke-width="1"/>
        <line x1="750" y1="20" x2="750" y2="40" stroke="${dimLine}" stroke-width="1"/>
        <text x="400" y="25" font-family="monospace" font-size="14" fill="${dimText}" text-anchor="middle">${dimLength}</text>

        <rect x="50" y="50" width="700" height="500" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M50,50 L750,50 L750,550 L50,550 Z M250,50 L250,550 M550,50 L550,550 M50,300 L250,300 M550,300 L750,300" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        
        <!-- Doors -->
        <line x1="230" y1="180" x2="270" y2="180" stroke="${floor}" stroke-width="14"/>
        <line x1="230" y1="430" x2="270" y2="430" stroke="${floor}" stroke-width="14"/>
        <line x1="530" y1="180" x2="570" y2="180" stroke="${floor}" stroke-width="14"/>
        <line x1="530" y1="430" x2="570" y2="430" stroke="${floor}" stroke-width="14"/>

        <text x="150" y="190" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">主卧</text>
        <text x="150" y="440" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">次卧1</text>
        <text x="400" y="320" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">客餐厅</text>
        <text x="650" y="190" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">次卧2</text>
        <text x="650" y="440" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">厨房/卫</text>
      `;
      break;
    case 4: // 4B2B
      content = `
        <rect x="50" y="50" width="700" height="500" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M50,50 L750,50 L750,550 L50,550 Z M250,50 L250,550 M550,50 L550,550 M50,200 L250,200 M50,350 L250,350 M550,300 L750,300" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <text x="150" y="140" font-family="sans-serif" font-size="18" fill="${textFill}" text-anchor="middle">主卧</text>
        <text x="150" y="290" font-family="sans-serif" font-size="18" fill="${textFill}" text-anchor="middle">次卧1</text>
        <text x="150" y="460" font-family="sans-serif" font-size="18" fill="${textFill}" text-anchor="middle">次卧2</text>
        <text x="400" y="320" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">客餐厅</text>
        <text x="650" y="190" font-family="sans-serif" font-size="18" fill="${textFill}" text-anchor="middle">次卧3</text>
        <text x="650" y="440" font-family="sans-serif" font-size="18" fill="${textFill}" text-anchor="middle">厨房/卫</text>
      `;
      break;
    case 5: // Duplex 1st floor
      content = `
        <rect x="100" y="50" width="600" height="500" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M100,50 L700,50 L700,550 L100,550 Z M400,50 L400,550" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <rect x="150" y="100" width="100" height="100" fill="#e2e8f0" stroke="${wall}" stroke-width="4"/>
        <line x1="150" y1="120" x2="250" y2="120" stroke="${wall}" stroke-width="2"/>
        <line x1="150" y1="140" x2="250" y2="140" stroke="${wall}" stroke-width="2"/>
        <line x1="150" y1="160" x2="250" y2="160" stroke="${wall}" stroke-width="2"/>
        <line x1="150" y1="180" x2="250" y2="180" stroke="${wall}" stroke-width="2"/>
        <text x="200" y="160" font-family="sans-serif" font-size="18" fill="${textFill}" text-anchor="middle">楼梯</text>
        <text x="250" y="400" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">客厅</text>
        <text x="550" y="320" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">餐厅/厨房</text>
      `;
      break;
    case 6: // Small Office
      content = `
        <rect x="100" y="100" width="600" height="400" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M100,100 L700,100 L700,500 L100,500 Z M500,100 L500,500 M500,300 L700,300" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <text x="300" y="320" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">开放办公区</text>
        <text x="600" y="220" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">会议室</text>
        <text x="600" y="420" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">经理室</text>
      `;
      break;
    case 7: // Medium Office
      content = `
        <rect x="50" y="50" width="700" height="500" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M50,50 L750,50 L750,550 L50,550 Z" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <rect x="300" y="200" width="200" height="200" fill="#e2e8f0" stroke="${wall}" stroke-width="12"/>
        <text x="400" y="310" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">核心筒/电梯</text>
        <text x="175" y="320" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">办公区 A</text>
        <text x="625" y="320" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">办公区 B</text>
      `;
      break;
    case 8: // Long Shape
      content = `
        <rect x="50" y="200" width="700" height="200" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M50,200 L750,200 L750,400 L50,400 Z M250,200 L250,400 M550,200 L550,400" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <text x="150" y="310" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">卧室</text>
        <text x="400" y="310" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">客餐厅</text>
        <text x="650" y="310" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">厨房/卫</text>
      `;
      break;
    case 9: // L Shape
      content = `
        <polygon points="100,100 400,100 400,300 700,300 700,500 100,500" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M100,100 L400,100 L400,300 L700,300 L700,500 L100,500 Z M400,300 L400,500" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <text x="250" y="320" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">客餐厅</text>
        <text x="550" y="420" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">卧室区</text>
      `;
      break;
    case 10: // Large Flat
      content = `
        <rect x="50" y="50" width="700" height="500" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M50,50 L750,50 L750,550 L50,550 Z M400,50 L400,550 M50,300 L400,300 M400,250 L750,250 M400,400 L750,400" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <text x="225" y="190" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">大客厅</text>
        <text x="225" y="440" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">主卧套房</text>
        <text x="575" y="160" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">次卧1</text>
        <text x="575" y="340" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">次卧2</text>
        <text x="575" y="490" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">厨房/保姆房</text>
      `;
      break;
  }
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    ${defs}
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    ${content}
  </svg>`;
  
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export const defaultFloorPlans: FloorPlan[] = [
  { id: '1', name: '默认户型 (3室2厅)', imageUrl: generateSvg(1, 12.5), type: 'default', widthMeters: 12.5 },
  { id: '2', name: '温馨两居 (2室1厅)', imageUrl: generateSvg(2, 9.0), type: 'default', widthMeters: 9.0 },
  { id: '3', name: '经典三居 (3室2厅)', imageUrl: generateSvg(3, 12.5), type: 'default', widthMeters: 12.5 },
  { id: '4', name: '豪华四居 (4室2厅)', imageUrl: generateSvg(4, 14.0), type: 'default', widthMeters: 14.0 },
  { id: '5', name: '复式一层', imageUrl: generateSvg(5, 10.0), type: 'default', widthMeters: 10.0 },
  { id: '6', name: '小型办公室', imageUrl: generateSvg(6, 15.0), type: 'default', widthMeters: 15.0 },
  { id: '7', name: '中型开放办公区', imageUrl: generateSvg(7, 25.0), type: 'default', widthMeters: 25.0 },
  { id: '8', name: '长条形户型', imageUrl: generateSvg(8, 16.0), type: 'default', widthMeters: 16.0 },
  { id: '9', name: 'L型户型', imageUrl: generateSvg(9, 12.0), type: 'default', widthMeters: 12.0 },
  { id: '10', name: '大平层', imageUrl: generateSvg(10, 18.0), type: 'default', widthMeters: 18.0 },
];

export const defaultAnalyses: Record<string, any> = {
  '1': { recommendedCount: 2, routers: [{id: 'r1', x: 25, y: 70, type: 'mesh'}, {id: 'r2', x: 65, y: 30, type: 'mesh'}], explanation: '该户型结构复杂，墙体较多。建议采用Mesh组网，一台放置在客厅覆盖公共区域和阳台，另一台放置在休闲区或走廊覆盖主卧和次卧，确保全屋无死角。' },
  '2': { recommendedCount: 1, routers: [{id: 'r1', x: 40, y: 50, type: 'high-power'}], explanation: '两居室户型，建议将路由器放置在客厅靠近两间卧室过道的位置。这样信号穿透一堵墙即可到达各个卧室，保证整体覆盖。' },
  '3': { recommendedCount: 2, routers: [{id: 'r1', x: 30, y: 50, type: 'mesh'}, {id: 'r2', x: 75, y: 50, type: 'mesh'}], explanation: '三居室面积较大，单台路由器可能在边缘房间出现信号死角。建议采用Mesh组网，一台放在客厅覆盖公共区域，另一台放在走廊深处或主卧覆盖休息区。' },
  '4': { recommendedCount: 3, routers: [{id: 'r1', x: 30, y: 50, type: 'mesh'}, {id: 'r2', x: 75, y: 25, type: 'mesh'}, {id: 'r3', x: 75, y: 75, type: 'mesh'}], explanation: '四居室空间开阔且墙体较多。推荐使用3台路由器进行Mesh组网：客厅主路由，两侧休息区各配置一个子路由，确保全屋5G频段满格。' },
  '5': { recommendedCount: 2, routers: [{id: 'r1', x: 30, y: 70, type: 'high-power'}, {id: 'r2', x: 70, y: 50, type: 'high-power'}], explanation: '复式结构需要考虑楼上楼下的信号穿透。一楼建议在客厅和餐厅各部署一个节点，并尽量靠近楼梯口，以便信号向二楼自然延伸。' },
  '6': { recommendedCount: 2, routers: [{id: 'r1', x: 30, y: 50, type: 'high-power'}, {id: 'r2', x: 75, y: 50, type: 'standard'}], explanation: '小型办公区分为开放区和独立办公室。开放区放置一台高带机量AP，独立办公室区域放置另一台，确保会议和办公网络稳定。' },
  '7': { recommendedCount: 3, routers: [{id: 'r1', x: 20, y: 50, type: 'mesh'}, {id: 'r2', x: 80, y: 50, type: 'mesh'}, {id: 'r3', x: 50, y: 20, type: 'mesh'}], explanation: '中型办公区有核心筒阻挡信号。建议在核心筒两侧的办公区A和B各部署一台，并在过道补充一台，形成无缝漫游网络。' },
  '8': { recommendedCount: 2, routers: [{id: 'r1', x: 25, y: 50, type: 'mesh'}, {id: 'r2', x: 75, y: 50, type: 'mesh'}], explanation: '长条形户型极易在两端出现信号衰减。必须采用双节点或多节点分布式路由，分别放置在户型的两端区域。' },
  '9': { recommendedCount: 2, routers: [{id: 'r1', x: 30, y: 30, type: 'mesh'}, {id: 'r2', x: 70, y: 70, type: 'mesh'}], explanation: 'L型户型存在天然的信号遮挡拐角。建议在L型的两个分支区域各放置一台路由器，通过无线或有线回程连接。' },
  '10': { recommendedCount: 3, routers: [{id: 'r1', x: 30, y: 50, type: 'mesh'}, {id: 'r2', x: 75, y: 25, type: 'mesh'}, {id: 'r3', x: 75, y: 75, type: 'mesh'}], explanation: '大平层面积大、房间多。采用AC+AP方案或高端Mesh方案，客厅作为核心节点，主卧和次卧群各增加一个覆盖节点。' },
};
