const API_URL = "https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D";
// 使用公共的 CORS 代理伺服器
const PROXY_URL = "https://api.allorigins.win/raw?url=";

// 台北市主要測站經緯度座標對照表 (用於地圖定位)
const stationCoords = {
  "湖田國小": { lat: 25.1528, lon: 121.5323 },
  "大屯國小": { lat: 25.1741, lon: 121.4925 },
  "桃源國中": { lat: 25.1397, lon: 121.4914 },
  "北投國小": { lat: 25.1321, lon: 121.5005 },
  "陽明高中": { lat: 25.0945, lon: 121.5148 },
  "太平國小": { lat: 25.0610, lon: 121.5111 },
  "民生國中": { lat: 25.0602, lon: 121.5606 },
  "中正國中": { lat: 25.0336, lon: 121.5201 },
  "三興國小": { lat: 25.0303, lon: 121.5583 },
  "格致國中": { lat: 25.1362, lon: 121.5387 },
  "平等國小": { lat: 25.1278, lon: 121.5714 },
  "至善國中": { lat: 25.1014, lon: 121.5489 },
  "碧湖國小": { lat: 25.0811, lon: 121.5878 },
  "東湖國小": { lat: 25.0689, lon: 121.6169 },
  "瑠公國中": { lat: 25.0372, lon: 121.5847 },
  "舊莊國小": { lat: 25.0402, lon: 121.6186 },
  "博嘉國小": { lat: 25.0000, lon: 121.5886 },
  "北政國中": { lat: 24.9861, lon: 121.5786 },
  "長安國小": { lat: 25.0489, lon: 121.5283 },
  "萬華國中": { lat: 25.0278, lon: 121.4986 },
  "台灣大學(新)": { lat: 25.0175, lon: 121.5397 },
  "雙園": { lat: 25.0232, lon: 121.4925 },
  "中洲": { lat: 25.1235, lon: 121.4608 }
};

let myMap;
let canvas;
let mappa;
let rainData = [];
let recTime = "讀取中...";
let hoveredStationPanel = "";
let weatherParticles = [];
let isRaining = false;
let sunAngle = 0;
let leftPanel;

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('pointer-events', 'none'); // 讓滑鼠事件能穿透畫布，去操作下方的地圖
  canvas.style('z-index', '999');
  
  // 建立地圖容器 (取代 mappa，解決 mappa.js 核心與最新環境的 onload 衝突問題)
  let mapDiv = createDiv();
  mapDiv.position(0, 0);
  mapDiv.style('width', '100vw');
  mapDiv.style('height', '100vh');
  mapDiv.style('z-index', '-1'); // 放到最底層
  mapDiv.id('leaflet-map');

  // 初始化原生的 Leaflet 地圖
  myMap = L.map('leaflet-map', { zoomControl: false, attributionControl: false }).setView([25.08, 121.55], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(myMap);

  // 預先準備右上角天氣動畫的雨滴粒子
  for (let i = 0; i < 60; i++) {
    weatherParticles.push({
      x: random(-40, 40),
      y: random(-20, 60),
      speed: random(3, 6),
      len: random(10, 20)
    });
  }

  // 取得 API 資料
  fetchData();
}

function draw() {
  clear(); // 清除 p5 畫布背景，否則會蓋住下方的地圖
  
  drawWeatherEffect(); // 右上角動畫
  drawLegend();        // 右下角圖例
  
  let hoveredStationMap = null;
  
  // 將雨量測站標示到地圖上
  for (let i = 0; i < rainData.length; i++) {
    let s = rainData[i];
    let stName = s.stationName;
    
    if (stationCoords[stName]) {
      let coords = stationCoords[stName];
      // 利用 Leaflet 原生的方法轉換經緯度為螢幕像素座標
      let pt = myMap.latLngToContainerPoint([coords.lat, coords.lon]);
      let pos = { x: pt.x, y: pt.y };
      
      // 解析雨量，這裡取用 rain 或 10MinRain 皆可兼容
      let rainVal = parseFloat(s.rain !== undefined ? s.rain : (s['10MinRain'] || 0));
      
      let d = dist(mouseX, mouseY, pos.x, pos.y);
      let isHoveredMap = d < 18;
      let isHoveredPanel = (hoveredStationPanel === stName);
      
      // 如果在左側面板被 hover 或是在地圖上被 hover 時圓圈放大
      let r = (isHoveredPanel || isHoveredMap) ? 35 : 18;
      
      fill(getColor(rainVal));
      stroke(0);
      strokeWeight(1);
      circle(pos.x, pos.y, r);
      
      // 如果滑鼠剛好在地圖上的點位，留待後面畫出 Tooltip 確保不被蓋住
      if (isHoveredMap) {
        hoveredStationMap = { name: stName, rain: rainVal, x: pos.x, y: pos.y };
      }
    }
  }
  
  // 繪製地圖圓點上的 Hover Tooltip
  if (hoveredStationMap) {
    fill(255, 230);
    stroke(100);
    rect(mouseX + 15, mouseY + 15, 140, 50, 5);
    fill(0);
    noStroke();
    textAlign(LEFT, TOP);
    textSize(14);
    text(`測站: ${hoveredStationMap.name}`, mouseX + 25, mouseY + 22);
    text(`雨量: ${hoveredStationMap.rain} mm`, mouseX + 25, mouseY + 42);
  }
  
  // 畫面上方顯示資料產生時間
  fill(0, 180);
  noStroke();
  rect(0, 0, windowWidth, 35);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  text(`台北市即時雨量 - 資料產生時間: ${recTime}`, windowWidth / 2, 17);
}

function fetchData() {
  const fetchUrl = PROXY_URL + encodeURIComponent(API_URL);
  
  fetch(fetchUrl)
    .then(res => res.json())
    .then(data => {
      let dataList = data.data || data; // 適應不同的 API 格式
      if (!Array.isArray(dataList)) dataList = [];
      
      rainData = dataList;
      
      if (rainData.length > 0) {
        recTime = rainData[0].recTime || new Date().toLocaleString();
      }
      
      checkWeather();
      buildLeftPanel();
    })
    .catch(err => {
      console.error("資料載入失敗:", err);
      recTime = "資料載入失敗";
    });
}

function checkWeather() {
  isRaining = false;
  // 確認台北市現在有沒有在下雨，若任何一站有雨就切換下雨動畫
  for (let i = 0; i < rainData.length; i++) {
    let s = rainData[i];
    if (stationCoords[s.stationName]) {
      let rainVal = parseFloat(s.rain !== undefined ? s.rain : (s['10MinRain'] || 0));
      if (rainVal > 0) {
        isRaining = true;
        break;
      }
    }
  }
}

// 使用 p5 的 DOM 產生左邊控制面板
function buildLeftPanel() {
  if (leftPanel) leftPanel.remove();
  
  leftPanel = createDiv();
  leftPanel.position(15, 50);
  leftPanel.style('width', '240px');
  leftPanel.style('height', (windowHeight - 80) + 'px');
  leftPanel.style('overflow-y', 'auto');
  leftPanel.style('background', 'rgba(255, 255, 255, 0.9)');
  leftPanel.style('padding', '15px');
  leftPanel.style('border-radius', '8px');
  leftPanel.style('box-shadow', '0 0 10px rgba(0,0,0,0.3)');
  leftPanel.style('z-index', '999'); 
  
  let title = createElement('h3', '各測站雨量列表');
  title.style('margin-top', '0');
  title.parent(leftPanel);
  
  let validStations = rainData.filter(s => stationCoords[s.stationName]);
  
  validStations.forEach(s => {
    let rainVal = parseFloat(s.rain !== undefined ? s.rain : (s['10MinRain'] || 0));
    let item = createDiv(`<b>${s.stationName}</b><br>雨量: ${rainVal} mm`);
    item.style('padding', '10px');
    item.style('margin-bottom', '8px');
    item.style('background', '#f1f1f1');
    
    // 解析 Color 物件並做成 CSS 可以用的顏色
    let c = getColor(rainVal);
    item.style('border-left', `6px solid rgba(${c.levels[0]},${c.levels[1]},${c.levels[2]},1)`);
    item.style('border-radius', '4px');
    item.style('cursor', 'pointer');
    item.style('transition', '0.2s background');
    
    item.mouseOver(() => {
      item.style('background', '#d5d5d5');
      hoveredStationPanel = s.stationName; // 儲存滑鼠移動上的站名
    });
    item.mouseOut(() => {
      item.style('background', '#f1f1f1');
      if (hoveredStationPanel === s.stationName) {
        hoveredStationPanel = "";
      }
    });
    item.parent(leftPanel);
  });
}

// 繪製右上角天氣動態效果
function drawWeatherEffect() {
  push();
  translate(windowWidth - 80, 95); 
  
  if (isRaining) {
    fill(150, 150, 150, 220);
    noStroke();
    ellipse(0, -20, 80, 40);
    ellipse(-20, -10, 60, 40);
    ellipse(20, -10, 60, 40);
    
    stroke(100, 150, 255, 200);
    strokeWeight(2);
    for (let p of weatherParticles) {
      line(p.x, p.y, p.x, p.y + p.len);
      p.y += p.speed;
      if (p.y > 60) {
        p.y = -20;
        p.x = random(-40, 40);
      }
    }
  } else {
    sunAngle += 0.01;
    rotate(sunAngle);
    fill(255, 215, 0, 230); // 太陽黃色
    noStroke();
    circle(0, 0, 45);
    
    stroke(255, 215, 0, 230);
    strokeWeight(4);
    for (let i = 0; i < 8; i++) {
      rotate(TWO_PI / 8);
      line(30, 0, 45, 0);
    }
  }
  pop();
}

// 繪製雨量圖例面板
function drawLegend() {
  push();
  let legendX = windowWidth - 210;
  let legendY = windowHeight - 230;
  
  fill(255, 255, 255, 230);
  stroke(200);
  rect(legendX, legendY, 190, 200, 8);
  
  fill(0);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(15);
  text("雨量顏色區分", legendX + 15, legendY + 12);
  
  let categories = [
    { label: "0 mm (天空色)", color: getColor(0) },
    { label: "0.1 - 2.0 mm", color: getColor(1) },
    { label: "2.1 - 10.0 mm", color: getColor(5) },
    { label: "10.1 - 20.0 mm (太陽黃)", color: getColor(15) },
    { label: "20.1 - 40.0 mm", color: getColor(30) },
    { label: "> 40.0 mm (紅色)", color: getColor(50) }
  ];
  
  for (let i = 0; i < categories.length; i++) {
    fill(categories[i].color);
    stroke(0);
    circle(legendX + 25, legendY + 45 + i * 26, 16);
    
    fill(0);
    noStroke();
    textSize(13);
    text(categories[i].label, legendX + 42, legendY + 38 + i * 26);
  }
  pop();
}

// 提供六個分類，並包含 天空色 及 太陽黃色
function getColor(rainAmount) {
  if (rainAmount === 0) return color(135, 206, 235, 220); // 天空色 Sky Blue
  if (rainAmount <= 2) return color(160, 232, 175, 220);  // 淺綠
  if (rainAmount <= 10) return color(56, 176, 0, 220);    // 深綠
  if (rainAmount <= 20) return color(254, 228, 64, 220);  // 太陽黃色 Sun Yellow
  if (rainAmount <= 40) return color(255, 158, 0, 220);   // 橘色
  return color(224, 30, 55, 220);                         // 紅色
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (leftPanel) {
    leftPanel.style('height', (windowHeight - 80) + 'px');
  }
}