const puppeteer = require('puppeteer');
const ora = require('ora');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const { timeout, writeFileSync } = require('./utils');

const spinner1 = ora({
  color: 'yellow'
});

const spinner2 = ora({
  color: 'yellow'
});

let provinces = require('./provinces')['86'];
let cities = [];
let areas = [];
const pcodes = Object.keys(provinces)
const target = 'https://www.stats.gov.cn/sj/tjbz/tjyqhdmhcxhfdm/2023/#{route}.html';
console.log(pcodes.join(', '))

async function getCitiesByPCode (page, pcode) {
  try {
    const url = target.replace('#{route}', pcode);
    const parentCode = `${pcode}`;
    await page.goto(url);
    spinner1.text = chalk.blue(`正在抓取${provinces[parentCode]}的市级数据：${url}`);

    cities = await page.evaluate((parentCode, cities) => {
      const list = [...document.querySelectorAll('.citytable .citytr')];
      list.forEach(el => {
        const t = el.innerText.split('\t');
        cities.push({
          code: t[0].slice(0, 4), 
          text: t[1],
          parentCode: parentCode
        });
      });
      return cities;
    }, parentCode, cities);

  } catch (error) {
    console.error(`\n ${provinces[parentCode]}的市级数据：${url} 抓取失败！`)
  }
}

async function getAreasByCCode (page, city) {
  try {
    const url = target.replace('#{route}', `${city.code.slice(0, 2)}/${city.code.slice(0, 4)}`);
    await page.goto(url);
    spinner2.text = chalk.blue(`正在抓取 ${provinces[city.parentCode]}/${city.text} 的县区数据：${url}`);

    areas = await page.evaluate((city, areas) => {
      let list = [...document.querySelectorAll('.countytable .countytr')];
      let istowntr = false; // 是否是镇级

      if (!list.length) {
        // 修正海儋州市，中山，东莞等待的区域数据
        istowntr = true;
        list = [...document.querySelectorAll('.countytable .towntr')];
      }

      list.forEach(el => {
        const t = el.innerText.split('\t');
        areas.push({
          code: t[0].slice(0, istowntr? 9 : 6),
          text: t[1],
          parentCode: `${city.code}`
        })
      });
      return areas;
    }, city, areas);

  } catch (error) {
    console.error(`\n ${provinces[city.parentCode]}/${city.text} 的县区数据：${url} 抓取失败！`)
  }
}

(async () => {
  spinner1.start(chalk.blue('开始抓取市区数据....'));

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  if (!cities.length) {
    for (let i = 0, l = pcodes.length; i < l; i++) {
      const pcode = pcodes[i];
      await timeout(1000);
      await getCitiesByPCode(page, pcode)
    }

    writeFileSync('cities_2023.js', cities);
    spinner1.succeed(chalk.green('市区数据抓取完毕，开始抓取县区数据....'));
  } else {
    spinner1.succeed(chalk.green('市区数据已经抓取过，开始抓取县区数据....'));
  }

  console.log('\n');
  spinner2.start(chalk.blue('正在抓取县区数据....'));

  for(let i = 0, l = cities.length; i < l; i++) {
    const city = cities[i];
    await timeout(1000);
    await getAreasByCCode(page, city)
  }

  writeFileSync('areas_2023.js', areas);
  spinner2.succeed(chalk.green('县区数据抓取完毕'));

  await browser.close();
})();