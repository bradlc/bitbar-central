#!/usr/bin/env /usr/local/n/versions/node/8.4.0/bin/node

const { promisify } = require('util')
const cheerio = require('cheerio')
const FileCookieStore = require('tough-cookie-filestore')
const fs = require('fs')
const openFile = promisify(fs.open)
const writeFile = promisify(fs.writeFile)
const write = promisify(fs.write)
let request = promisify(require('request'))

const CURRENT_SCRIPT =
  typeof process.pkg === 'undefined' ? process.argv[1] : process.argv[0]
const BASE_URL = 'http://central.exposecms.com'
const COOKIE_FILE = `${process.env.HOME}/.centralrc`
let COOKIE_JAR

const p =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAACXBIWXMAABYlAAAWJQFJUiTwAAABUUlEQVRYw+2Y0W3DIBCG/z/qez1CN0g2KCNkBI/gETxCRmAEd4NkA7JBuoEzwfXlKlmI1ECgtlqfdA/GcHz673wgU0SwJtthZbYB/Q8gkg3JnqQjKZ47fddkEYlIkgPoAIwAZMZHAF1y/EQYGwHiu60CBKAPbOZUMaPe6Zg/ry8KBOAQ2KSbSas//1ASyE9VG7GmzUldDEzjBR4S0jx4a5sSQCZH+gepNnNrYvqQ8dqES2gp7qdY29ERsNuiQCTNqoAAHL1ntxgQyTftRd/2ISLjIkB60g8AXifDw68XtV5LWq2V/eTVRURsTIyXAkoYbYAGwHtg2jVQS2WBVIXOUyFkFwDHmNrJBiJ5fqDE1D71ymFT4+coFIK56yd91sPX5ZbBMzV0B3B6FqAU0FXvRK50y9hlKlMFJhfoVAsmF8iioiUDicitJhC33zEb0F8D+gITUozAEmo0AQAAAABJRU5ErkJggg=='

const pWithDot =
  'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAACXBIWXMAABYlAAAWJQFJUiTwAAABWElEQVRYw+2YwY2DMBBF/1/lvpSQDpYSUgIlUAIdLJ2E7YASnA4ogRJIBbOH9cEaGbAds+TgkUYixh4/DZ75VigieCf7wJtZASpApwCRrEh2JCeSonyy76okIhGJcgA3ADMA2fEZwC06fiRMGwCivT0ECEANYFGbDW4WbPYGNWcBUB8BZNRGzcbcRs01WYFsdtwNuoA1nVpT5wTq3cMakVX38Pcha0LLvnaeh4giHlZivNyHqgw9ryrS4bGr82xOBbLS0ThD89kZ6gB8Or/H04BItgC+naEfEVn+HYhkQ9IAuDvDT9vHguyS4YzUVsO+PNOeVuvmQ4FI9p4zou1hJWbKfh/yCOuWj1vCm0vL1oAWKw/d3mXMdmo3jgFQ5QQafQEjY5hcQGPC1XftE19T1F5XTpurVegKTAEaQ5ucp+p2x1KA5sRkNArgobTur6WUfz8KUAE62H4B7wxgGWRB29oAAAAASUVORK5CYII='
;(async function() {
  COOKIE_JAR = await getCookieJar()
  request = request.defaults({ followAllRedirects: true, jar: COOKIE_JAR })

  if (process.argv.includes('--in')) return checkIn()

  if (process.argv.includes('--out')) return checkOut()

  if (process.argv.includes('-login')) {
    // the last arg is the user id
    const userId = process.argv[process.argv.length - 1]
    return login(userId)
  }

  if (process.argv.includes('--logout')) return logout()

  const userId = getCurrentUserId()

  if (userId === -1) {
    return renderGuest()
  }

  return renderUser(userId)
})()

async function getCookieJar() {
  try {
    const fd = await openFile(COOKIE_FILE, 'wx')
    await write(fd, '{}', 0, 'utf8')
  } catch (e) {
    // file exists
  }

  return request.jar(new FileCookieStore(COOKIE_FILE))
}

function getCurrentUserId() {
  const cookie = COOKIE_JAR.getCookieString(BASE_URL).match(
    /CakeCookie\[employee_id\]=([0-9]+)/
  )

  if (cookie === null) return -1

  return cookie[1]
}

async function renderGuest() {
  const res = await request({
    url: `${BASE_URL}/times/employee`
  })

  const $ = cheerio.load(res.body)

  const users = $('.staff-picker__li > a')
    .map((i, el) => {
      return {
        id: $(el)
          .attr('href')
          .split('/')
          .pop(),
        name: $(el)
          .text()
          .trim()
      }
    })
    .get()
    .sort((a, b) => {
      if (a.name < b.name) return -1
      if (a.name > b.name) return 1
      return 0
    })

  console.log(`| templateImage=${p}`)

  console.log('---')

  console.log('Not logged in')

  console.log('Log in')

  users.forEach(user => {
    console.log(
      `--${user.name} | bash=${CURRENT_SCRIPT} param1=-login param2=${user.id} terminal=false refresh=true`
    )
  })
}

async function renderUser(userId) {
  const res = await request({
    url: `${BASE_URL}/times/employee/${userId}`
  })

  const $ = cheerio.load(res.body)

  const today = $(`.total-time-row td:nth-child(${new Date().getDay()})`).text()
  const doneToday = today.match(/([0-9]{1,2})h ([0-9]{1,2})/)

  let checkedIn = false
  const buttonLabel = $('input[name="data[Time][status]"]').attr('value')
  if (buttonLabel === 'Check Out') {
    checkedIn = true
  }

  console.log(
    `${doneToday[1]}:${doneToday[2].padStart(
      2,
      '0'
    )} | templateImage=${checkedIn ? pWithDot : p}`
  )

  console.log('---')

  const weekRemaining = $('.over-under')
    .eq(1)
    .text()
    .match(/(over|under) by (([0-9]{1,2}) hrs? )?([0-9]{1,2}) mins?/)
  const weekRemainingHours =
    weekRemaining[3] !== undefined ? weekRemaining[3] : 0
  const weekRemainingMins = weekRemaining[4].padStart(2, '0')

  console.log(
    `${weekRemainingHours}:${weekRemainingMins} ${weekRemaining[1] === 'under'
      ? 'remaining'
      : 'over'} this week`
  )

  console.log('---')

  console.log(`Currently checked ${checkedIn ? 'in' : 'out'}`)

  console.log(
    `Check ${checkedIn
      ? 'out'
      : 'in'} | bash=${CURRENT_SCRIPT} param1=--${checkedIn
      ? 'out'
      : 'in'} terminal=false refresh=true`
  )

  console.log('---')

  const user = $('.profile__employee')
    .text()
    .replace('Log out', '')
    .trim()

  console.log(`Logged in as ${user}`)

  console.log(
    `Log out | bash=${CURRENT_SCRIPT} param1=--logout terminal=false refresh=true`
  )
}

async function login(userId) {
  await request({
    url: `${BASE_URL}/times/employee/${userId}`
  })
}

async function logout() {
  await writeFile(COOKIE_FILE, '{}', 'utf8')
}

async function checkIn() {
  await request({
    method: 'post',
    url: BASE_URL,
    form: { 'data[Time][status]': 'Check In' }
  })
}

async function checkOut() {
  await request({
    method: 'post',
    url: BASE_URL,
    form: { 'data[Time][status]': 'Check Out' }
  })
}
