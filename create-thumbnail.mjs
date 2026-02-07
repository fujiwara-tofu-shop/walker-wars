import { createCanvas } from 'canvas';
import fs from 'fs';

const canvas = createCanvas(1200, 630);
const ctx = canvas.getContext('2d');

// Sky gradient background
const skyGrad = ctx.createLinearGradient(0, 0, 0, 630);
skyGrad.addColorStop(0, '#87CEEB');
skyGrad.addColorStop(1, '#E0F6FF');
ctx.fillStyle = skyGrad;
ctx.fillRect(0, 0, 1200, 630);

// Sun
ctx.fillStyle = '#FFD700';
ctx.beginPath();
ctx.arc(1000, 100, 60, 0, Math.PI * 2);
ctx.fill();

// Ground/sidewalk
ctx.fillStyle = '#808080';
ctx.fillRect(0, 480, 1200, 150);

// Sidewalk lines
ctx.strokeStyle = '#A0A0A0';
ctx.lineWidth = 3;
for (let x = 0; x < 1200; x += 100) {
  ctx.beginPath();
  ctx.moveTo(x, 480);
  ctx.lineTo(x, 630);
  ctx.stroke();
}

// Draw an old person with walker
function drawWalkerPerson(x, y, color) {
  // Walker frame
  ctx.strokeStyle = '#C0C0C0';
  ctx.lineWidth = 6;
  
  // Walker legs
  ctx.beginPath();
  ctx.moveTo(x - 25, y + 40);
  ctx.lineTo(x - 25, y + 100);
  ctx.moveTo(x + 25, y + 40);
  ctx.lineTo(x + 25, y + 100);
  ctx.stroke();
  
  // Walker horizontal bars
  ctx.beginPath();
  ctx.moveTo(x - 25, y + 40);
  ctx.lineTo(x + 25, y + 40);
  ctx.moveTo(x - 25, y + 70);
  ctx.lineTo(x + 25, y + 70);
  ctx.stroke();
  
  // Tennis balls on walker feet
  ctx.fillStyle = '#ADFF2F';
  ctx.beginPath();
  ctx.arc(x - 25, y + 105, 10, 0, Math.PI * 2);
  ctx.arc(x + 25, y + 105, 10, 0, Math.PI * 2);
  ctx.fill();
  
  // Body (behind walker)
  ctx.fillStyle = color;
  ctx.fillRect(x - 15, y - 20, 30, 50);
  
  // Head
  ctx.fillStyle = '#FFE4C4';
  ctx.beginPath();
  ctx.arc(x, y - 40, 25, 0, Math.PI * 2);
  ctx.fill();
  
  // Gray hair
  ctx.fillStyle = '#D3D3D3';
  ctx.beginPath();
  ctx.arc(x, y - 50, 20, Math.PI, 0);
  ctx.fill();
  
  // Glasses
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - 15, y - 45, 12, 10);
  ctx.rect(x + 3, y - 45, 12, 10);
  ctx.moveTo(x - 3, y - 40);
  ctx.lineTo(x + 3, y - 40);
  ctx.stroke();
}

// Draw contestants racing
drawWalkerPerson(200, 380, '#FF6B6B');  // Red cardigan
drawWalkerPerson(450, 350, '#4ECDC4');  // Player in teal
drawWalkerPerson(650, 390, '#9B59B6');  // Purple
drawWalkerPerson(850, 370, '#F39C12');  // Orange

// Speed lines
ctx.strokeStyle = 'rgba(255,255,255,0.6)';
ctx.lineWidth = 3;
for (let i = 0; i < 5; i++) {
  ctx.beginPath();
  ctx.moveTo(50 + i * 20, 350 + i * 15);
  ctx.lineTo(120 + i * 20, 350 + i * 15);
  ctx.stroke();
}

// Title
ctx.fillStyle = '#FFD700';
ctx.strokeStyle = '#333';
ctx.lineWidth = 8;
ctx.font = 'bold 90px Comic Sans MS, sans-serif';
ctx.textAlign = 'center';
ctx.strokeText('WALKER WARS', 600, 140);
ctx.fillText('WALKER WARS', 600, 140);

// Subtitle
ctx.font = '36px Comic Sans MS, sans-serif';
ctx.fillStyle = '#fff';
ctx.strokeStyle = '#333';
ctx.lineWidth = 4;
ctx.strokeText('The Ultimate Geriatric Racing Experience', 600, 200);
ctx.fillText('The Ultimate Geriatric Racing Experience', 600, 200);

// Emojis
ctx.font = '60px serif';
ctx.fillText('👴 🏃 👵', 600, 280);

// Finish line flag at far right
ctx.fillStyle = '#fff';
ctx.fillRect(1120, 320, 60, 160);
ctx.fillStyle = '#000';
// Checkerboard pattern
for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 3; col++) {
    if ((row + col) % 2 === 0) {
      ctx.fillRect(1120 + col * 20, 320 + row * 20, 20, 20);
    }
  }
}

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('public/og-image.png', buffer);
console.log('Created public/og-image.png');
