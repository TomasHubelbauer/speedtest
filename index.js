const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const email = require('../self-email');
const headers = require('../self-email/headers');
const footer = require('../self-email/footer');
const chart = require('./chart');

async function goNetflix() {
  const browser = await puppeteer.launch();
  const [page] = await browser.pages();
  await page.goto('https://fast.com');
  await page.waitForSelector('#show-more-details-link', { visible: true });
  const speed = await page.$eval('#speed-value', div => div.textContent);
  await browser.close();
  return speed;
}

async function goOokla() {
  const browser = await puppeteer.launch();
  const [page] = await browser.pages();
  await page.goto('https://www.speedtest.net');
  await page.waitForSelector('button#_evidon-banner-acceptbutton');
  await page.click('button#_evidon-banner-acceptbutton');
  await page.waitForSelector('a.js-start-test', { visible: true });
  await page.click('a.js-start-test');
  await page.waitForSelector('span.download-speed:not([data-download-status-value="NaN"])');
  const speed = await page.$eval('span.download-speed', span => span.textContent);
  await browser.close();
  return speed;
}

async function renderChart() {
  const browser = await puppeteer.launch();
  const [page] = await browser.pages();
  await page.goto(__dirname + '/chart.svg');
  const url = await page.screenshot({ encoding: 'base64', clip: { x: 0, y: 0, width: 640, height: 480 } });
  await browser.close();
  return url.match(/.{1,10}/g);
}

module.exports = (
  async function () {
    let netflix;
    try {
      netflix = await goNetflix();
      console.log('Netflix', netflix);
      await fs.appendFile('netflix.csv', `${new Date().toISOString()},${netflix}\n`);
    }
    catch (error) {
      netflix = 'failed';
      console.log('Netflix error', error);
      // Ignore the individual service failure, we'll deal if all services fail
    }

    let ookla;
    try {
      ookla = await goOokla();
      console.log('Ookla', ookla);
      await fs.appendFile('ookla.csv', `${new Date().toISOString()},${ookla}\n`);
    }
    catch (error) {
      ookla = 'failed';
      console.log('Ookla error', error);
      // Ignore the individual service failure, we'll deal if all services fail
    }

    async function parsePoints(path) {
      const text = await fs.readFile(path, { encoding: 'ascii' });
      const lines = text.split('\n').slice(0, -1); // Ditch newline at the end
      const cells = lines.map(l => l.split(','));
      return cells.map(c => ({ x: new Date(c[0]).valueOf(), y: Number(c[1]) }));
    }

    const netflixPoints = { color: 'maroon', points: await parsePoints('netflix.csv') };
    const ooklaPoints = { color: 'blue', points: await parsePoints('ookla.csv') };
    await fs.writeFile('chart.svg', chart(netflixPoints, ooklaPoints).join('\n'));

    await email(
      headers(`Netflix ${netflix} & Ookla ${ookla}`, 'Speedtest'),
      '<ul>',
      `<li>Netflix: ${netflix}</li>`,
      `<li>Ookla: ${ookla}</li>`,
      '</ul>',

      // Note that rendering SVG directly to EML has poor support so we render PNG
      '<img src="data:image/png;base64,',
      ...await renderChart(),
      '" />',
      ...footer('Speedtest')
    );
  }
)()
