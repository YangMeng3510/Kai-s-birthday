// Fireworks -> message transition demo
// Message: "王老师，生日快乐！" formed by colorful point-matrix particles.

let rockets = [];       // active rockets (ascenders)
let fragments = [];     // explosion particles
let msgParticles = [];  // particles used to form message (targets)
let particlePool = [];  // pool to reuse fragment particles

let spawnTimer = 0;
let spawnInterval = 40;

// control when to turn an explosion into the message
let explosionsUntilMessage;
let pendingMessage = false;

const GRAVITY = 0.06;
const WIND = 0.00;

// message settings
let msgString = "王老师，生日快乐！";
let msgTargets = [];

// visual tuning
const ROCKET_COLOR = [255, 220, 160];
const SKY_ALPHA = 14;

// 存储当前文字的中心位置
let currentMessageCenterX = 0;
let currentMessageCenterY = 0;

// 文字状态管理 - 简化版本
let messageDisplayStartTime = 0;
let isMessageActive = false;

// 先声明类
class FragmentParticle {
  constructor() {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.size = 3;
    this.color = color(255);
    this.life = 80;
    this.age = 0;
    this.dead = true;
    this.alpha = 255;
  }

  reset(x,y,vx,vy,col) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.size = random(2.2, 5.2);
    this.color = col || color(random(200,255), random(120,255), random(120,255));
    this.life = random(60, 160);
    this.age = 0;
    this.dead = false;
    this.alpha = 255;
  }

  update() {
    this.age++;
    this.vy += GRAVITY;
    this.vx += WIND * 0.005;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.995;
    this.vy *= 0.998;
    this.alpha = map(this.age, 0, this.life, 255, 0);

    if (this.age > this.life || this.y > height + 200) {
      this.dead = true;
    }
  }

  draw() {
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), this.alpha);
    circle(this.x, this.y, this.size);
  }
}

class Rocket {
  constructor(x) {
    this.x = x !== undefined ? x : random(width * 0.15, width * 0.85);
    this.y = height + random(10, 80);
    this.vx = random(-0.4, 0.4);
    this.vy = random(-8.5, -11.5);
    this.size = random(3, 5);
    this.trail = [];
    this.exploded = false;
    this.color = color(random(200,255), random(140,220), random(100,200));
    this.age = 0;
    this.fuseHeight = random(height * 0.2, height * 0.45);
  }

  update() {
    this.age++;
    this.vy += GRAVITY * 0.02;
    this.vx += WIND * 0.001;
    this.x += this.vx;
    this.y += this.vy;

    this.trail.push({x:this.x, y:this.y, life:120});
    if (this.trail.length > 20) this.trail.shift();

    this.x += sin(this.age * 0.08) * 0.3;

    if (this.y < this.fuseHeight || this.vy > -1) {
      this.explode();
      this.exploded = true;
    }
  }

  draw() {
    noStroke();
    fill(this.color);
    circle(this.x, this.y, this.size);

    for (let i = this.trail.length - 1; i >= 0; i--) {
      let t = this.trail[i];
      let idx = this.trail.length - i;
      let a = map(idx, 0, this.trail.length, 10, 180);
      fill(red(this.color), green(this.color), blue(this.color), a);
      circle(t.x, t.y, map(idx, 0, this.trail.length, 1.2, 4.6));
    }
  }

  offscreen() {
    return this.y < -50 || this.x < -100 || this.x > width + 100;
  }

  explode() {
    if (!pendingMessage) {
      explosionsUntilMessage--;
      if (explosionsUntilMessage <= 0) {
        pendingMessage = true;
        explosionsUntilMessage = getRandomCountdown();
      }
    }
    
    const n = pendingMessage ? 3000 : floor(random(80, 280));
    for (let i = 0; i < n; i++) {
      let f = obtainFragment();
      let ang = random(TWO_PI);
      let power = pendingMessage ? random(0.6, 3.6) : random(1.8, 6.5);
      f.reset(this.x, this.y, cos(ang) * power, sin(ang) * power * 0.9, 
              color(random(120,255), random(120,255), random(120,255)));
      f.life = pendingMessage ? 240 : random(40, 110);
      fragments.push(f);
    }

    if (pendingMessage) {
      // 记录当前烟花的中心位置作为文字中心
      currentMessageCenterX = this.x;
      currentMessageCenterY = this.y;
      prepareMessageTargets(this.x, this.y);
      pendingMessage = false;
    }
  }
}

class MessageParticle {
  constructor(sx, sy, tx, ty, col) {
    this.x = sx;
    this.y = sy;
    this.tx = tx;
    this.ty = ty;
    this.vx = 0;
    this.vy = 0;
    this.col = col || color(255);
    this.size = random(3.0, 5.0);
    this.arrived = false;
    this.alpha = 0; // 初始完全透明
    this.arrivalTime = 0; // 到达目标的时间
    this.delay = random(0, 60); // 随机延迟，让粒子不同时到达
  }

  updateToTarget() {
    if (!this.arrived) {
      // 平滑移动到目标位置
      let dx = this.tx - this.x;
      let dy = this.ty - this.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 2 || this.delay > 0) {
        // 如果很近或者还有延迟，直接设置位置
        if (this.delay <= 0) {
          this.x = this.tx;
          this.y = this.ty;
          this.arrived = true;
          this.arrivalTime = frameCount;
        } else {
          this.delay--;
        }
      } else {
        // 平滑移动
        let speed = map(dist, 0, 100, 0.5, 8);
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
        this.x += this.vx;
        this.y += this.vy;
      }
    } else {
      // 到达目标后，逐渐增加透明度
      let timeSinceArrival = frameCount - this.arrivalTime;
      this.alpha = min(255, timeSinceArrival * 8); // 逐渐显现
    }
  }

  drawToTarget() {
    if (this.alpha > 0) {
      noStroke();
      fill(red(this.col), green(this.col), blue(this.col), this.alpha);
      circle(this.x, this.y, this.size);
    }
  }

  atTarget() {
    return this.arrived && this.alpha >= 255;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  colorMode(RGB);
  background(0);
  
  textFont('Arial');
  explosionsUntilMessage = getRandomCountdown();
  
  for (let i = 0; i < 300; i++) {
    particlePool.push(new FragmentParticle());
  }
}

function draw() {
  noStroke();
  fill(0, SKY_ALPHA);
  rect(0, 0, width, height);

  spawnTimer++;
  if (spawnTimer > spawnInterval) {
    spawnTimer = 0;
    spawnInterval = floor(random(28, 60));
    launchRocket();
  }

  for (let i = rockets.length - 1; i >= 0; i--) {
    let r = rockets[i];
    r.update();
    r.draw();
    if (r.exploded || r.offscreen()) {
      rockets.splice(i, 1);
    }
  }

  for (let i = fragments.length - 1; i >= 0; i--) {
    let f = fragments[i];
    f.update();
    f.draw();
    if (f.dead) {
      particlePool.push(f);
      fragments.splice(i, 1);
    }
  }

  if (msgParticles.length > 0) {
    let allAtTarget = true;
    
    for (let p of msgParticles) {
      p.updateToTarget();
      p.drawToTarget();
      if (!p.atTarget()) {
        allAtTarget = false;
      }
    }
    
    if (allAtTarget) {
      // 第一次所有粒子到达目标时，记录开始时间
      if (!isMessageActive) {
        isMessageActive = true;
        messageDisplayStartTime = frameCount;
        console.log("文字完全形成，开始3秒显示计时");
      }
      
      // 计算文字完全形成后的时间
      let displayTime = frameCount - messageDisplayStartTime;
      
      // 显示3秒后爆炸消失（180帧 ≈ 3秒）
      if (displayTime > 180) {
        console.log("3秒显示时间结束，立即爆炸消失");
        // 立即创建爆炸效果并清空文字
        createMassiveExplosion();
        msgParticles = [];
        isMessageActive = false;
        explosionsUntilMessage = getRandomCountdown();
      }
    }
  }
}

// 创建大规模爆炸效果
function createMassiveExplosion() {
  console.log("创建大规模爆炸效果");
  
  // 1. 为每个文字粒子位置创建爆炸
  for (let p of msgParticles) {
    createSmallExplosion(p.x, p.y, p.col);
  }
  
  // 2. 在文字中心创建大爆炸
  createLargeExplosion(currentMessageCenterX, currentMessageCenterY);
  
  // 3. 在文字周围创建额外爆炸点
  for (let i = 0; i < 10; i++) {
    let randomX = currentMessageCenterX + random(-width/3, width/3);
    let randomY = currentMessageCenterY + random(-height/3, height/3);
    createSmallExplosion(randomX, randomY, color(random(150,255), random(150,255), random(150,255)));
  }
}

// 创建小爆炸（10-20个粒子）
function createSmallExplosion(x, y, baseColor) {
  let particleCount = floor(random(5, 10));
  
  for (let i = 0; i < particleCount; i++) {
    let f = obtainFragment();
    let ang = random(TWO_PI);
    let power = random(2, 6);
    
    let explosionColor = color(
      red(baseColor) + random(-30, 30),
      green(baseColor) + random(-30, 30),
      blue(baseColor) + random(-30, 30)
    );
    
    f.reset(x, y, cos(ang) * power, sin(ang) * power, explosionColor);
    f.life = random(60, 100);
    f.size = random(2, 3);
    fragments.push(f);
  }
}

// 创建大爆炸（100-150个粒子）
function createLargeExplosion(x, y) {
  let particleCount = floor(random(50, 100));
  
  for (let i = 0; i < particleCount; i++) {
    let f = obtainFragment();
    let ang = random(TWO_PI);
    let power = random(3, 10);
    
    let explosionColor = color(
      random(150, 255),
      random(150, 255),
      random(150, 255)
    );
    
    f.reset(x, y, cos(ang) * power, sin(ang) * power, explosionColor);
    f.life = random(80, 150);
    f.size = random(3, 5);
    fragments.push(f);
  }
}

function obtainFragment() {
  if (particlePool.length > 0) {
    return particlePool.pop();
  }
  return new FragmentParticle();
}

function launchRocket(x) {
  rockets.push(new Rocket(x));
}

function mousePressed() {
  let count = floor(random(1,3));
  for (let i = 0; i < count; i++) {
    launchRocket(constrain(mouseX + random(-60,60), 30, width-30));
  }
}

function getRandomCountdown() {
  return floor(random(4, 8));
}

function prepareMessageTargets(centerX, centerY) {
  // 在创建新文字前，如果已有文字，先强制爆炸消失
  if (msgParticles.length > 0) {
    console.log("强制清除之前的文字");
    createMassiveExplosion();
    msgParticles = [];
  }
  
  let gfx = createGraphics(width * 2, height * 2);
  gfx.pixelDensity(1);
  gfx.background(0, 0);
  gfx.fill(255);
  gfx.noStroke();
  
  let fontSize = min(width, height) * 0.2;
  gfx.textSize(fontSize);
  gfx.textAlign(CENTER, CENTER);
  gfx.textFont('Arial');
  
  // 在canvas中心绘制文字
  gfx.text(msgString, gfx.width / 2, gfx.height / 2);

  const step = 8;
  msgTargets = [];
  
  gfx.loadPixels();
  for (let y = 0; y < gfx.height; y += step) {
    for (let x = 0; x < gfx.width; x += step) {
      let idx = 4 * (x + y * gfx.width);
      if (gfx.pixels[idx + 3] > 128) {
        // 将坐标映射回主canvas尺寸，并以烟花爆炸点为中心
        let targetX = map(x, 0, gfx.width, centerX - width/2, centerX + width/2);
        let targetY = map(y, 0, gfx.height, centerY - height/2, centerY + height/2);
        
        // 确保坐标在画布范围内
        targetX = constrain(targetX, 0, width);
        targetY = constrain(targetY, 0, height);
        
        let col = color(
          random(150, 255), 
          random(150, 255), 
          random(150, 255)
        );
        msgTargets.push({x: targetX, y: targetY, col: col});
      }
    }
  }
  gfx.remove();

  console.log("生成的文字粒子数量:", msgTargets.length);

  msgParticles = [];
  for (let i = 0; i < msgTargets.length; i++) {
    let t = msgTargets[i];
    let p;
    
    if (fragments.length > 0) {
      p = fragments.pop();
      p = new MessageParticle(p.x, p.y, t.x, t.y, t.col);
    } else if (particlePool.length > 0) {
      let base = particlePool.pop();
      p = new MessageParticle(
        centerX + random(-50, 50), 
        centerY + random(-50, 50), 
        t.x, t.y, t.col
      );
    } else {
      p = new MessageParticle(
        centerX + random(-50, 50), 
        centerY + random(-50, 50), 
        t.x, t.y, t.col
      );
    }
    msgParticles.push(p);
  }

  msgParticles = shuffleArray(msgParticles);
  
  // 重置文字状态
  isMessageActive = false;
}

function shuffleArray(array) {
  let newArray = array.slice();
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  if (key === ' ') {
    let r = new Rocket(random(width*0.2, width*0.8));
    r.fuseHeight = random(height*0.12, height*0.3);
    rockets.push(r);
    pendingMessage = true;
  }
}