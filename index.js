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

module.exports = async function () {
  let netflix;
  if (process.argv[2] === 'dry-run') {
    netflix = 'dry-run';
  }
  else {
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
  }

  let ookla;
  if (process.argv[2] === 'dry-run') {
    ookla = 'dry-run';
  }
  else {
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
  }

  async function parsePoints(path) {
    const text = await fs.readFile(path, { encoding: 'ascii' });
    const lines = text.split('\n').slice(0, -1); // Ditch newline at the end
    const cells = lines.map(l => l.split(','));
    return cells.map(c => ({ x: new Date(c[0]).valueOf(), y: Number(c[1]) }));
  }

  function makeChart(netflixPoints, ooklaPoints, limit) {
    if (limit) {
      netflixPoints = { ...netflixPoints, points: netflixPoints.points.filter(p => p.x >= limit) };
      ooklaPoints = { ...ooklaPoints, points: ooklaPoints.points.filter(p => p.x >= limit) };
    }

    const svg = chart(netflixPoints, ooklaPoints);
    return [
      '<img width="100%" src="',
      'data:image/svg+xml;base64,',

      // The Base64 lines each of 76 characters for MIME lines
      ...Buffer.from(svg).toString('base64').match(/.{0,76}/g),
      '" />'
    ];
  }

  const netflixPoints = { color: 'maroon', points: await parsePoints('netflix.csv') };
  const ooklaPoints = { color: 'blue', points: await parsePoints('ookla.csv') };

  let last24hours = new Date();
  last24hours.setHours(last24hours.getHours() - 24);

  let last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  let last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  // Embed SVG in `img` with a Base64 data URI because SVG in EML doesn't work
  await email(
    headers(`Netflix ${netflix} & Ookla ${ookla}`, 'Speedtest'),
    '<ul>',
    `<li>Netflix: ${netflix}</li>`,
    `<li>Ookla: ${ookla}</li>`,
    '</ul>',
    '<b>Last 24 hours</b>',
    ...makeChart(netflixPoints, ooklaPoints, last24hours),
    '<b>Lat 7 days</b>',
    ...makeChart(netflixPoints, ooklaPoints, last7Days),
    '<b>Lat 30 days</b>',
    ...makeChart(netflixPoints, ooklaPoints, last30Days),
    '<b>All time</b>',
    ...makeChart(netflixPoints, ooklaPoints),
    ...footer('Speedtest')
  );
};

module.exports = module.exports();
