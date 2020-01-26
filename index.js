const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const email = require('../self-email');

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

void async function () {
  let netflix;
  try {
    netflix = await goNetflix();
    console.log('Netflix', netflix);
    await fs.appendFile('speeds.log', `${new Date().toISOString()} Netflix ${netflix}\n`);
  }
  catch (error) {
    console.log('Netflix error', error);
    // Ignore the individual service failure, we'll deal if all services fail
  }

  let ookla;
  try {
    ookla = await goOokla();
    console.log('Ookla', ookla);
    await fs.appendFile('speeds.log', `${new Date().toISOString()} Ookla ${ookla}\n`);
  }
  catch (error) {
    console.log('Ookla error', error);
    // Ignore the individual service failure, we'll deal if all services fail
  }

  if (!netflix && !ookla) {
    // TODO: Email a notification to myself
  }

  await email(`
From: Speedtest <bot@hubelbauer.net>
To: tomas@hubelbauer.net
Subject: Speedtest
Content-Type: text/html

<ul>
<li>Netflix: ${netflix}</li>
<li>Ookla: ${ookla}</li>
</ul>

Thanks!
`);
}()
