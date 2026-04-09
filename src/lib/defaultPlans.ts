export interface FloorPlan {
  id: string;
  name: string;
  imageUrl: string;
  originalImage?: string; // Store original image for editing
  aspectRatio?: number; // Store original aspect ratio to preserve physical dimensions
  type: 'default' | 'uploaded';
  widthMeters?: number;
  scenario: 'home' | 'enterprise' | 'office' | 'hotel' | 'shop' | 'hospital';
  analysisResult?: any;
  routers?: any[];
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
    case 11: // Large Campus
      content = `
        <rect x="50" y="50" width="700" height="500" fill="#e5e7eb" filter="url(#drop-shadow)"/>
        <path d="M50,50 L750,50 L750,550 L50,550 Z" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        
        <!-- Building A -->
        <rect x="100" y="100" width="250" height="150" fill="${floor}" stroke="${wall}" stroke-width="6"/>
        <text x="225" y="180" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">研发中心 A栋</text>
        
        <!-- Building B -->
        <rect x="450" y="100" width="200" height="150" fill="${floor}" stroke="${wall}" stroke-width="6"/>
        <text x="550" y="180" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">行政楼 B栋</text>
        
        <!-- Building C -->
        <rect x="100" y="350" width="250" height="150" fill="${floor}" stroke="${wall}" stroke-width="6"/>
        <text x="225" y="430" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">生产车间 C栋</text>
        
        <!-- Building D -->
        <rect x="450" y="350" width="200" height="150" fill="${floor}" stroke="${wall}" stroke-width="6"/>
        <text x="550" y="430" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">仓储中心 D栋</text>
        
        <!-- Roads/Paths -->
        <path d="M350,50 L350,550 M450,50 L450,550 M50,250 L750,250 M50,350 L750,350" fill="none" stroke="#9ca3af" stroke-width="20" stroke-dasharray="10,10"/>
      `;
      break;
    case 12: // CAD Blueprint (Enterprise)
      content = `
        <rect width="100%" height="100%" fill="#0f172a"/>
        <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="1"/>
        </pattern>
        <pattern id="cad-grid-large" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#cad-grid)"/>
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" stroke-width="2"/>
        </pattern>
        <rect width="100%" height="100%" fill="url(#cad-grid-large)"/>
        <g stroke="#38bdf8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Outer walls -->
          <rect x="100" y="100" width="600" height="400" />
          <!-- Inner walls -->
          <path d="M 300 100 L 300 500 M 500 100 L 500 300 M 500 300 L 700 300" />
          <!-- Doors (cyan arcs) -->
          <path d="M 300 200 A 40 40 0 0 1 340 240" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="4 4"/>
          <path d="M 500 200 A 40 40 0 0 1 540 240" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="4 4"/>
        </g>
        <!-- Dimensions -->
        <g fill="#94a3b8" font-family="monospace" font-size="12">
          <text x="400" y="90" text-anchor="middle">24000 mm</text>
          <text x="80" y="300" transform="rotate(-90 80,300)" text-anchor="middle">16000 mm</text>
        </g>
        <text x="200" y="300" font-family="sans-serif" font-size="24" fill="#38bdf8" text-anchor="middle">办公区 A</text>
        <text x="400" y="200" font-family="sans-serif" font-size="24" fill="#38bdf8" text-anchor="middle">会议室</text>
        <text x="600" y="200" font-family="sans-serif" font-size="24" fill="#38bdf8" text-anchor="middle">机房</text>
        <text x="500" y="400" font-family="sans-serif" font-size="24" fill="#38bdf8" text-anchor="middle">办公区 B</text>
      `;
      break;
    case 13: // 3D Floor Plan (Home)
      content = `
        <rect width="100%" height="100%" fill="#f1f5f9"/>
        <!-- Floor base -->
        <rect x="150" y="100" width="500" height="400" fill="#f8fafc" filter="url(#drop-shadow)" rx="4"/>
        
        <!-- 3D Walls (Extruded effect) -->
        <g fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1">
          <!-- Top wall -->
          <path d="M 150 100 L 650 100 L 650 120 L 150 120 Z" />
          <!-- Bottom wall -->
          <path d="M 150 480 L 650 480 L 650 500 L 150 500 Z" />
          <!-- Left wall -->
          <path d="M 150 100 L 170 100 L 170 500 L 150 500 Z" />
          <!-- Right wall -->
          <path d="M 630 100 L 650 100 L 650 500 L 630 500 Z" />
          <!-- Inner wall -->
          <path d="M 350 120 L 370 120 L 370 350 L 350 350 Z" />
          <path d="M 350 330 L 630 330 L 630 350 L 350 350 Z" />
        </g>
        
        <!-- Furniture (Simple 3D blocks) -->
        <g fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" filter="url(#drop-shadow)">
          <!-- Bed -->
          <rect x="190" y="140" width="100" height="120" rx="4"/>
          <rect x="190" y="140" width="100" height="30" fill="#cbd5e1" rx="4"/>
          <!-- Sofa -->
          <rect x="400" y="380" width="150" height="60" rx="4"/>
          <rect x="400" y="420" width="150" height="20" fill="#cbd5e1" rx="4"/>
        </g>
        <text x="260" y="280" font-family="sans-serif" font-size="20" fill="#64748b" text-anchor="middle">卧室</text>
        <text x="500" y="240" font-family="sans-serif" font-size="20" fill="#64748b" text-anchor="middle">厨房/餐厅</text>
        <text x="500" y="400" font-family="sans-serif" font-size="20" fill="#64748b" text-anchor="middle">客厅</text>
      `;
      break;
    case 14: // Hotel Room
      content = `
        <rect x="200" y="50" width="400" height="500" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M200,50 L600,50 L600,550 L200,550 Z M200,200 L350,200 M350,200 L350,50" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <rect x="220" y="70" width="110" height="110" fill="${bathFloor}"/>
        <text x="275" y="135" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">卫浴</text>
        <text x="400" y="350" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">客房区</text>
        <rect x="450" y="250" width="120" height="150" fill="none" stroke="${furniture}" stroke-width="3"/>
      `;
      break;
    case 15: // Shop
      content = `
        <rect x="100" y="100" width="600" height="400" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M100,100 L700,100 L700,500 L100,500 Z M100,400 L300,400 M300,400 L300,500" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <text x="400" y="250" font-family="sans-serif" font-size="28" fill="${textFill}" text-anchor="middle">商品展示区</text>
        <text x="200" y="460" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">仓库/后场</text>
        <rect x="350" y="350" width="200" height="40" fill="none" stroke="${furniture}" stroke-width="3"/>
        <text x="450" y="375" font-family="sans-serif" font-size="16" fill="${textFill}" text-anchor="middle">收银台</text>
      `;
      break;
    case 16: // Hospital Clinic
      content = `
        <rect x="50" y="50" width="700" height="500" fill="${floor}" filter="url(#drop-shadow)"/>
        <path d="M50,50 L750,50 L750,550 L50,550 Z M50,250 L750,250 M50,350 L750,350 M250,50 L250,250 M500,50 L500,250 M250,350 L250,550 M500,350 L500,550" fill="none" stroke="${wall}" stroke-width="12" stroke-linecap="square"/>
        <text x="400" y="310" font-family="sans-serif" font-size="24" fill="${textFill}" text-anchor="middle">公共走廊 / 候诊区</text>
        <text x="150" y="160" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">诊室 1</text>
        <text x="375" y="160" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">诊室 2</text>
        <text x="625" y="160" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">诊室 3</text>
        <text x="150" y="460" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">检查室 A</text>
        <text x="375" y="460" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">检查室 B</text>
        <text x="625" y="460" font-family="sans-serif" font-size="20" fill="${textFill}" text-anchor="middle">护士站</text>
      `;
      break;
  }
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    ${defs}
    ${type !== 12 && type !== 13 ? `<rect width="100%" height="100%" fill="${bg}"/>\n    <rect width="100%" height="100%" fill="url(#grid)"/>` : ''}
    ${content}
  </svg>`.replace(/font-family="sans-serif"/g, 'font-family="\'Microsoft YaHei\', sans-serif"');
  
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export const defaultFloorPlans: FloorPlan[] = [
  { id: '1', name: '默认户型 (3室2厅)', imageUrl: generateSvg(1, 12.5), type: 'default', widthMeters: 12.5, scenario: 'home' },
  { id: '2', name: '温馨两居 (2室1厅)', imageUrl: generateSvg(2, 9.0), type: 'default', widthMeters: 9.0, scenario: 'home' },
  { id: '3', name: '经典三居 (3室2厅)', imageUrl: generateSvg(3, 12.5), type: 'default', widthMeters: 12.5, scenario: 'home' },
  { id: '4', name: '豪华四居 (4室2厅)', imageUrl: generateSvg(4, 14.0), type: 'default', widthMeters: 14.0, scenario: 'home' },
  { id: '5', name: '复式一层', imageUrl: generateSvg(5, 10.0), type: 'default', widthMeters: 10.0, scenario: 'home' },
  { id: '8', name: '长条形户型', imageUrl: generateSvg(8, 16.0), type: 'default', widthMeters: 16.0, scenario: 'home' },
  { id: '9', name: 'L型户型', imageUrl: generateSvg(9, 12.0), type: 'default', widthMeters: 12.0, scenario: 'home' },
  { id: '10', name: '大平层', imageUrl: generateSvg(10, 18.0), type: 'default', widthMeters: 18.0, scenario: 'home' },
  { id: '13', name: '3D 户型图示例', imageUrl: generateSvg(13, 10.0), type: 'default', widthMeters: 10.0, scenario: 'home' },
  { id: '6', name: '小型办公室', imageUrl: generateSvg(6, 15.0), type: 'default', widthMeters: 15.0, scenario: 'office' },
  { id: '7', name: '中型开放办公区', imageUrl: generateSvg(7, 25.0), type: 'default', widthMeters: 25.0, scenario: 'office' },
  { id: '11', name: '大型园区', imageUrl: generateSvg(11, 100.0), type: 'default', widthMeters: 100.0, scenario: 'enterprise' },
  { id: '12', name: 'CAD 蓝图示例', imageUrl: generateSvg(12, 24.0), type: 'default', widthMeters: 24.0, scenario: 'enterprise' },
  { id: '14', name: '标准客房', imageUrl: generateSvg(14, 6.0), type: 'default', widthMeters: 6.0, scenario: 'hotel' },
  { id: '15', name: '临街商铺', imageUrl: generateSvg(15, 8.0), type: 'default', widthMeters: 8.0, scenario: 'shop' },
  { id: '16', name: '门诊区域', imageUrl: generateSvg(16, 30.0), type: 'default', widthMeters: 30.0, scenario: 'hospital' },
];

export const defaultAnalyses: Record<string, any> = {
  '1': { 
    recommendedCount: 2, 
    equipment: '推荐使用Wi-Fi 6 Mesh路由器套装（2只装）',
    routers: [
      {id: 'r1', x: 25, y: 70, type: 'mesh', locationDescription: '客厅中心，覆盖主要活动区域及阳台'}, 
      {id: 'r2', x: 65, y: 30, type: 'mesh', locationDescription: '休闲区/走廊，覆盖主卧、次卫及厨房'}
    ], 
    explanation: {
      priority: '该3室2厅2卫户型结构复杂，墙体较多，重点保障主卧、次卧及客厅的高频用网需求，同时兼顾休闲区。',
      strategy: '建议采用Mesh组网，一台放置在客厅覆盖公共区域和阳台，另一台放置在休闲区或走廊覆盖主卧、次卧和厨房，确保全屋无死角。',
      summary: '双节点Mesh组网能有效解决多墙体带来的信号衰减问题，实现全屋漫游。'
    }
  },
  '2': { 
    recommendedCount: 1, 
    equipment: '推荐使用单台高功率Wi-Fi 6路由器',
    routers: [{id: 'r1', x: 40, y: 50, type: 'high-power', locationDescription: '客餐厅中心，靠近主次卧过道'}], 
    explanation: {
      priority: '该2室1厅1卫户型，重点覆盖客餐厅及主次卧。',
      strategy: '建议将路由器放置在客餐厅靠近两间卧室过道的位置。这样信号穿透一堵墙即可到达主卧和次卧，保证整体覆盖。',
      summary: '单台高性能路由居中放置即可满足两居室的日常需求。'
    }
  },
  '3': { 
    recommendedCount: 2, 
    equipment: '推荐使用Wi-Fi 6 Mesh路由器套装（2只装）',
    routers: [{id: 'r1', x: 30, y: 50, type: 'mesh'}, {id: 'r2', x: 75, y: 50, type: 'mesh'}], 
    explanation: {
      priority: '三居室面积较大，单台路由器可能在边缘房间出现信号死角。',
      strategy: '建议采用Mesh组网，一台放在客厅覆盖公共区域，另一台放在走廊深处或主卧覆盖休息区。',
      summary: '分布式部署有效提升边缘房间的信号质量。'
    }
  },
  '4': { 
    recommendedCount: 3, 
    equipment: '推荐使用Wi-Fi 6 Mesh路由器套装（3只装）',
    routers: [{id: 'r1', x: 30, y: 50, type: 'mesh'}, {id: 'r2', x: 75, y: 25, type: 'mesh'}, {id: 'r3', x: 75, y: 75, type: 'mesh'}], 
    explanation: {
      priority: '四居室空间开阔且墙体较多，重点保障多房间并发用网体验。',
      strategy: '推荐使用3台路由器进行Mesh组网：客厅主路由，两侧休息区各配置一个子路由，确保全屋5G频段满格。',
      summary: '三节点Mesh组网是平层大户型的最佳选择。'
    }
  },
  '5': { 
    recommendedCount: 2, 
    equipment: '推荐使用高功率Wi-Fi 6路由器（上下层各一）',
    routers: [{id: 'r1', x: 30, y: 70, type: 'high-power'}, {id: 'r2', x: 70, y: 50, type: 'high-power'}], 
    explanation: {
      priority: '复式结构需要重点考虑楼上楼下的信号穿透与楼梯间的衔接。',
      strategy: '一楼建议在客厅和餐厅各部署一个节点，并尽量靠近楼梯口，以便信号向二楼自然延伸。',
      summary: '合理利用楼梯间作为信号通道，提升跨层覆盖效果。'
    }
  },
  '6': { 
    recommendedCount: 2, 
    equipment: '1主1从 (联通FTTO企业级网关+AP)',
    routers: [
      {id: 'r1', x: 30, y: 50, type: 'ftto-main', locationDescription: '开放办公区中心，满足高密接入'}, 
      {id: 'r2', x: 75, y: 50, type: 'ftto-sub', locationDescription: '会议室与经理室交界处，保障独立空间覆盖'}
    ], 
    explanation: {
      priority: '该小型办公区分为开放区、会议室和经理室，重点保障开放区高密接入和会议室稳定。',
      strategy: '开放办公区放置一台高带机量主网关，会议室和经理室区域放置一台从网关，确保会议和办公网络稳定。',
      summary: '主从架构满足企业级高并发和稳定性要求。'
    }
  },
  '7': { 
    recommendedCount: 3, 
    equipment: '1主2从 (联通FTTO企业级网关+AP)',
    routers: [{id: 'r1', x: 20, y: 50, type: 'ftto-main'}, {id: 'r2', x: 80, y: 50, type: 'ftto-sub'}, {id: 'r3', x: 50, y: 20, type: 'ftto-sub'}], 
    explanation: {
      priority: '中型办公区有核心筒阻挡信号，重点解决信号盲区和漫游问题。',
      strategy: '建议在核心筒两侧的办公区A和B各部署一台，并在过道补充一台，形成无缝漫游网络。',
      summary: '多节点部署有效绕过物理障碍，实现全区覆盖。'
    }
  },
  '8': { 
    recommendedCount: 2, 
    equipment: '推荐使用Wi-Fi 6 Mesh路由器套装（2只装）',
    routers: [{id: 'r1', x: 25, y: 50, type: 'mesh'}, {id: 'r2', x: 75, y: 50, type: 'mesh'}], 
    explanation: {
      priority: '长条形户型极易在两端出现信号衰减，重点保障两端房间的覆盖。',
      strategy: '必须采用双节点或多节点分布式路由，分别放置在户型的两端区域。',
      summary: '分布式路由是解决长条形户型覆盖的最佳方案。'
    }
  },
  '9': { 
    recommendedCount: 2, 
    equipment: '推荐使用Wi-Fi 6 Mesh路由器套装（2只装）',
    routers: [{id: 'r1', x: 30, y: 30, type: 'mesh'}, {id: 'r2', x: 70, y: 70, type: 'mesh'}], 
    explanation: {
      priority: 'L型户型存在天然的信号遮挡拐角，重点解决拐角带来的信号衰减。',
      strategy: '建议在L型的两个分支区域各放置一台路由器，通过无线或有线回程连接。',
      summary: '分区域部署有效避开墙体遮挡。'
    }
  },
  '10': { 
    recommendedCount: 3, 
    equipment: '推荐使用高端Mesh路由器套装（3只装）或AC+AP方案',
    routers: [{id: 'r1', x: 30, y: 50, type: 'mesh'}, {id: 'r2', x: 75, y: 25, type: 'mesh'}, {id: 'r3', x: 75, y: 75, type: 'mesh'}], 
    explanation: {
      priority: '大平层面积大、房间多，重点保障全屋高速漫游和多设备并发。',
      strategy: '采用AC+AP方案或高端Mesh方案，客厅作为核心节点，主卧和次卧群各增加一个覆盖节点。',
      summary: '高端分布式方案提供极致的用网体验。'
    }
  },
  '11': { 
    recommendedCount: 5, 
    equipment: '1主4从 (联通FTTO企业级网关+高密AP)',
    routers: [
      {id: 'r1', x: 50, y: 50, type: 'ftto-main'}, 
      {id: 'r2', x: 20, y: 20, type: 'ftto-sub'}, 
      {id: 'r3', x: 80, y: 20, type: 'ftto-sub'},
      {id: 'r4', x: 20, y: 80, type: 'ftto-sub'},
      {id: 'r5', x: 80, y: 80, type: 'ftto-sub'}
    ], 
    explanation: {
      priority: '大型园区面积广阔，包含多栋建筑或大面积厂房，重点保障高密接入、无缝漫游及核心业务区域的高可用性。',
      strategy: '采用1主4从的FTTO全光组网方案，中心机房部署主网关，通过光纤延伸至各个区域部署从网关（高密AP），实现园区全覆盖。',
      summary: 'FTTO全光方案提供大带宽、低时延、易演进的企业级网络基座。'
    }
  },
  '12': { 
    recommendedCount: 4, 
    equipment: '1主3从 (联通FTTR企业级全光网关)',
    routers: [
      {id: 'r1', x: 25, y: 50, type: 'fttr-main'}, {id: 'r2', x: 50, y: 30, type: 'fttr-sub'},
      {id: 'r3', x: 75, y: 30, type: 'fttr-sub'}, {id: 'r4', x: 60, y: 70, type: 'fttr-sub'}
    ], 
    explanation: {
      priority: 'CAD蓝图显示的办公区包含多个独立隔间和会议室，需确保无缝漫游和高并发接入。',
      strategy: '采用FTTR方案，主路由位于机房，从路由分别部署在办公区A、办公区B和会议室。光纤布线隐蔽且带宽高。',
      summary: '1主3从的FTTR配置能有效覆盖所有功能区，满足企业级高标准网络需求。'
    }
  },
  '13': { 
    recommendedCount: 2, 
    equipment: '推荐使用Wi-Fi 6 Mesh路由器套装（2只装）',
    routers: [
      {id: 'r1', x: 30, y: 45, type: 'mesh'}, {id: 'r2', x: 70, y: 55, type: 'mesh'}
    ], 
    explanation: {
      priority: '3D户型图展示了立体空间结构，重点覆盖卧室和客餐厅区域。',
      strategy: '利用Mesh组网，主节点放置在客厅，子节点放置在卧室过道或内部，利用3D空间反射优化信号。',
      summary: '双节点Mesh组网结合3D空间特性，实现全屋信号的立体覆盖。'
    }
  },
  '14': { 
    recommendedCount: 1, 
    equipment: '1主 (联通FTTO企业级面板AP)',
    routers: [
      {id: 'r1', x: 50, y: 50, type: 'ftto-main', locationDescription: '客房中心，提供无死角覆盖'}
    ], 
    explanation: {
      priority: '酒店客房重点保障单房间内的信号满格和高带宽体验。',
      strategy: '采用入室面板AP部署，避免走廊AP穿墙带来的信号衰减。',
      summary: '单房间单AP是高星级酒店的标准配置。'
    }
  },
  '15': { 
    recommendedCount: 2, 
    equipment: '1主1从 (联通FTTO企业级网关+AP)',
    routers: [
      {id: 'r1', x: 50, y: 40, type: 'ftto-main', locationDescription: '商品展示区中心，满足顾客高密接入'},
      {id: 'r2', x: 20, y: 80, type: 'ftto-sub', locationDescription: '仓库/后场，保障店员办公及库存管理'}
    ], 
    explanation: {
      priority: '商铺环境需兼顾顾客体验和内部办公/收银系统的稳定性。',
      strategy: '展示区部署主网关满足高密接入，后场部署从网关保障内部业务。',
      summary: '主从架构完美契合商铺前后台不同的网络需求。'
    }
  },
  '16': { 
    recommendedCount: 4, 
    equipment: '1主3从 (联通FTTO企业级网关+AP)',
    routers: [
      {id: 'r1', x: 50, y: 50, type: 'ftto-main', locationDescription: '公共走廊/候诊区，满足大量患者接入'},
      {id: 'r2', x: 25, y: 25, type: 'ftto-sub', locationDescription: '诊室区域，保障医生办公系统稳定'},
      {id: 'r3', x: 75, y: 25, type: 'ftto-sub', locationDescription: '诊室区域，保障医生办公系统稳定'},
      {id: 'r4', x: 50, y: 80, type: 'ftto-sub', locationDescription: '检查室/护士站，保障医疗设备联网'}
    ], 
    explanation: {
      priority: '医院门诊区人流量大，且医疗设备对网络稳定性要求极高。',
      strategy: '走廊候诊区部署高密主网关，各诊室和护士站按需部署从网关，确保业务隔离和稳定。',
      summary: '多节点高密部署满足医院复杂场景的高标准要求。'
    }
  }
};
