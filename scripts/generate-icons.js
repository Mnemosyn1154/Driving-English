const fs = require('fs');
const path = require('path');

// Simple SVG icon for Driving English
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3c72;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2a5298;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <text x="256" y="280" font-family="Arial, sans-serif" font-size="180" font-weight="bold" text-anchor="middle" fill="white">DE</text>
  <text x="256" y="380" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="white">Driving English</text>
</svg>
`;

// Save SVG file
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);

// Create a simple placeholder for PNG icons
const placeholderNote = `Icon files need to be generated from the SVG.\nUse an online converter or graphic tool to convert icon.svg to PNG formats.`;
fs.writeFileSync(path.join(publicDir, 'icon-placeholder.txt'), placeholderNote);

console.log('SVG icon generated successfully!');
console.log('Please convert icon.svg to icon-192x192.png and icon-512x512.png');