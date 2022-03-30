import axios from 'axios'

import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const ipRangeCheck = require('ip-range-check')

const IGNORE_SAVE_INTERVAL = (60 * 30) * 1000
const IGNORE_FETCH_INTERVAL = (60 * 15) * 1000
const IGNORE_API_ENDPOINT_URI = 'https://app.censortracker.org/api/ignore/'

const SPECIAL_PURPOSE_IPS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '::/128',
  '::1/128',
  '::/96',
  '::ffff:/96',
  '2001:db8::/32',
  'fe80::/10',
  'fec0::/10',
  'fc00::/7',
  'ff00::/8',
]

class Ignore {
  constructor () {
    this._ignoredHosts = new Set()
    this._temporarilyIgnoredHosts = new Set()

    setInterval(async () => {
      await this.fetch()
    }, IGNORE_FETCH_INTERVAL)

    setInterval(async () => {
      await this.save()
    }, IGNORE_SAVE_INTERVAL)
  }

  fetch = async () => {
    try {
      const { data: domains } = await axios.get(IGNORE_API_ENDPOINT_URI)
      const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

      for (const domain of domains) {
        ignoredHosts.push(domain)
      }

      await storage.set({ ignoredHosts })
    } catch (error) {
      console.warn('Fetching ignored domains...')
    }
  }

  isSpecialPurposeIP = (ip) => {
    try {
      return ipRangeCheck(ip, SPECIAL_PURPOSE_IPS)
    } catch (error) {
      return false
    }
  }

  save = () => {
    storage.get({ ignoredHosts: [] })
      .then(({ ignoredHosts }) => {
        for (const hostname of ignoredHosts) {
          this._ignoredHosts.add(hostname)
        }
        console.log('All ignored domain saved!')
      })
  }

  clear = async () => {
    this._ignoredHosts.clear()
    this._temporarilyIgnoredHosts.clear()
    await storage.set({ ignoredHosts: [] })
  }

  add = async (url, { temporary = false } = {}) => {
    const hostname = extractHostnameFromUrl(url)

    console.warn(`Added to ignore: ${url}`)

    if (temporary === true) {
      this._temporarilyIgnoredHosts.add(hostname)
    } else {
      const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

      if (!ignoredHosts.includes(hostname)) {
        ignoredHosts.push(hostname)
        console.warn(`Adding ${hostname} to ignore`)
      }

      for (const item of ignoredHosts) {
        this._ignoredHosts.add(item)
      }

      await storage.set({ ignoredHosts })
    }
  }

  contains = (url) => {
    const ignoreRegEx = /localhost/
    const hostname = extractHostnameFromUrl(url)
    const ignoredHosts = new Set([
      ...this._ignoredHosts,
      ...this._temporarilyIgnoredHosts,
    ])

    if (ignoredHosts.has(hostname) || hostname.match(ignoreRegEx)) {
      console.warn(`Ignoring host: ${hostname}`)
      return true
    }
    return this.isSpecialPurposeIP(hostname)
  }
}

export default new Ignore()
