// HTML文字列を受け取って PNG ファイルに変換する(Puppeteer)
// 静止画なので @keyframes や networkidle0 の考慮は最小限
//
// 見切れ対策:
//  - document.documentElement.scrollWidth/scrollHeight で実際のレンダリング全域を取得
//  - ビューポートを実サイズに合わせて再設定
//  - fullPage:true で撮る(body margin など外側も含めて全域キャプチャ)

import puppeteer from 'puppeteer';

export async function captureHtmlToPng(html, outputPath, targetWidth) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    // 初期は高さ100pxの極小ビューポートで描画することで、
    // scrollHeight が「ビューポート高さ」ではなく「実コンテンツ高さ」を返すようにする
    await page.setViewport({
      width: targetWidth,
      height: 100,
      deviceScaleFactor: 2 // Retina相当(LINEで見てもくっきり)
    });
    // インラインCSS + data URI SVG なので domcontentloaded で十分
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    // フォントロード待ち
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    // 実際に描画されている全域のサイズを取得(margin 等の外側も含む)
    const size = await page.evaluate(() => {
      const de = document.documentElement;
      const body = document.body;
      const width = Math.max(
        de.scrollWidth, body.scrollWidth,
        de.offsetWidth, body.offsetWidth,
        de.clientWidth
      );
      const height = Math.max(
        de.scrollHeight, body.scrollHeight,
        de.offsetHeight, body.offsetHeight,
        de.clientHeight
      );
      return { width: Math.ceil(width), height: Math.ceil(height) };
    });

    // ビューポートを実コンテンツのサイズピッタリに再設定
    // (height はコンテンツ通り。下の空白を抑止)
    await page.setViewport({
      width: Math.max(size.width, targetWidth),
      height: size.height,
      deviceScaleFactor: 2
    });

    // fullPage:true で全域キャプチャ(margin / padding も含む)
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      omitBackground: false
    });
  } finally {
    await browser.close();
  }
}
