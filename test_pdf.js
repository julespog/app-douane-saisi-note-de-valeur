import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("Starting Vite dev server...");
  const viteProcess = exec('npm run dev', { cwd: '/Users/foubakleinarcel/Documents/PROJET DOUANIERE GULDAS' });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  // Set download path
  const downloadPath = path.resolve(__dirname, 'pdf_test_output');
  if (!fs.existsSync(downloadPath)){
    fs.mkdirSync(downloadPath);
  }
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath,
  });

  console.log("Navigating to /print-note...");
  await page.goto('http://localhost:5173/print-note', { waitUntil: 'networkidle0' });
  
  // Wait a bit for any dynamic rendering
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log("Measuring DOM layout...");
  const layout = await page.evaluate(() => {
    const getRect = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { top: Math.round(rect.top), height: Math.round(rect.height), bottom: Math.round(rect.bottom) };
    };

    const container = document.getElementById('pdf-content');
    const containerRect = getRect(container);

    const breaks = Array.from(document.querySelectorAll('.html2pdf__page-break'));
    const breakRects = breaks.map(b => getRect(b));

    const wrappers = Array.from(document.querySelectorAll('.print-wrapper'));
    const wrapperRects = wrappers.map(w => {
      const h2 = w.querySelector('h2');
      const table = w.querySelector('table');
      return {
        wrapper: getRect(w),
        h2: getRect(h2),
        table: getRect(table)
      };
    });

    return {
      container: containerRect,
      breaks: breakRects,
      wrappers: wrapperRects
    };
  });
  console.log(JSON.stringify(layout, null, 2));

  console.log("Clicking Download button...");
  // Find the button that contains "Télécharger PDF"
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const downloadBtn = buttons.find(b => b.textContent.includes('Télécharger PDF'));
    if (downloadBtn) {
      downloadBtn.click();
    } else {
      console.error("Download button not found!");
    }
  });

  console.log("Waiting for download to complete...");
  // Poll download path until a PDF appears
  let pdfFile = null;
  for (let i = 0; i < 30; i++) {
    const files = fs.readdirSync(downloadPath);
    pdfFile = files.find(f => f.endsWith('.pdf'));
    if (pdfFile) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (pdfFile) {
    console.log(`PDF downloaded successfully: ${pdfFile}`);
  } else {
    console.log("Download failed or timed out.");
  }

  console.log("Cleaning up...");
  await browser.close();
  viteProcess.kill();
  process.exit(0);
}

run().catch(console.error);
