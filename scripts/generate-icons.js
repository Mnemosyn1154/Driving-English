const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Icon sizes required for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  const publicDir = path.join(__dirname, '..', 'public');
  const iconsDir = path.join(publicDir, 'icons');
  const svgPath = path.join(publicDir, 'icon.svg');
  
  try {
    // Check if icon.svg exists
    try {
      await fs.access(svgPath);
      console.log('Found existing icon.svg');
    } catch {
      console.log('icon.svg not found, creating default icon...');
      
      // Simple SVG icon for Driving English
      const svgIcon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3c72;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2a5298;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <text x="256" y="280" font-family="Arial, sans-serif" font-size="180" font-weight="bold" text-anchor="middle" fill="white">DE</text>
  <text x="256" y="380" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="white">Driving English</text>
</svg>`;
      
      await fs.writeFile(svgPath, svgIcon);
      console.log('Created icon.svg');
    }
    
    // Ensure icons directory exists
    await fs.mkdir(iconsDir, { recursive: true });
    console.log('Ensured icons directory exists');
    
    console.log('\nGenerating PWA icons from icon.svg...');
    
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      
      try {
        await sharp(svgPath)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toFile(outputPath);
        
        console.log(`✓ Generated ${size}x${size} icon`);
      } catch (error) {
        console.error(`✗ Failed to generate ${size}x${size} icon:`, error.message);
      }
    }
    
    // Also generate the standard icon-192x192.png and icon-512x512.png in public root
    try {
      await sharp(svgPath)
        .resize(192, 192, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join(publicDir, 'icon-192x192.png'));
      console.log(`✓ Generated icon-192x192.png in public root`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-192x192.png:`, error.message);
    }
    
    try {
      await sharp(svgPath)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join(publicDir, 'icon-512x512.png'));
      console.log(`✓ Generated icon-512x512.png in public root`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-512x512.png:`, error.message);
    }
    
    console.log('\nIcon generation complete!');
    console.log('Icons are available in:', iconsDir);
    
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

// Run the generation
generateIcons().catch(console.error);