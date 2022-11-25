import Browser from './browser-api'
import Registry from './registry'

class ProxyManager {
  async getProxyServerURI () {
    const {
      proxyServerURI,
      customProxyServerURI,
    } = await Browser.storage.local.get([
      'proxyServerURI',
      'customProxyServerURI',
    ])

    if (customProxyServerURI) {
      console.warn('Using custom proxy for PAC.')
      return customProxyServerURI
    }
    return proxyServerURI
  }

  async requestIncognitoAccess () {
    if (Browser.IS_FIREFOX) {
      const isAllowedIncognitoAccess =
        await Browser.extension.isAllowedIncognitoAccess()

      if (!isAllowedIncognitoAccess) {
        await Browser.browserAction.setBadgeText({ text: '✕' })
        await Browser.storage.local.set({
          privateBrowsingPermissionsRequired: true,
        })
        console.info('Private browsing permissions requested.')
      }
    }
  }

  async grantIncognitoAccess () {
    if (Browser.IS_FIREFOX) {
      await Browser.browserAction.setBadgeText({ text: '' })
      await Browser.storage.local.set({
        privateBrowsingPermissionsRequired: false,
      })
    }
  }

  async setProxy () {
    const config = {}
    const pacData = await this.generateProxyAutoConfigData()

    if (!pacData) {
      await this.removeProxy()
      return false
    }

    if (Browser.IS_FIREFOX) {
      const blob = new Blob([pacData], {
        type: 'application/x-ns-proxy-autoconfig',
      })

      config.value = {
        proxyType: 'autoConfig',
        autoConfigUrl: URL.createObjectURL(blob),
      }
    } else {
      config.scope = 'regular'
      config.value = {
        mode: 'pac_script',
        pacScript: {
          data: pacData,
          mandatory: false,
        },
      }
    }

    try {
      await Browser.proxy.settings.set(config)
      await this.enableProxy()
      await this.grantIncognitoAccess()
      console.warn('PAC has been set successfully!')
      return true
    } catch (error) {
      console.error(`PAC could not be set: ${error}`)
      await this.disableProxy()
      await this.requestIncognitoAccess()
      return false
    }
  }

  /**
   * ATTENTION: DO NOT MODIFY THIS FUNCTION!
   */
  async generateProxyAutoConfigData () {
    const domains = await Registry.getDomains()

    if (domains.length === 0) {
      return undefined
    }

    const proxyServerURI = await this.getProxyServerURI()

    await Browser.storage.local.set({ proxyServerURI })

    domains.sort()
    return `
      function FindProxyForURL(url, host) {
        function isHostBlocked(array, target) {
          let left = 0;
          let right = array.length - 1;

          while (left <= right) {
            const mid = left + Math.floor((right - left) / 2);

            if (array[mid] === target) {
              return true;
            }

            if (array[mid] < target) {
              left = mid + 1;
            } else {
              right = mid - 1;
            }
          }
          return false;
        }

        // Remove ending dot
        if (host.endsWith('.')) {
          host = host.substring(0, host.length - 1);
        }

        // Make domain second-level.
        let lastDot = host.lastIndexOf('.');
        if (lastDot !== -1) {
          lastDot = host.lastIndexOf('.', lastDot - 1);
          if (lastDot !== -1) {
            host = host.substr(lastDot + 1);
          }
        }

        // Domains, which are blocked.
        let domains = ${JSON.stringify(domains)};

        // Return result
        if (isHostBlocked(domains, host)) {
          return 'HTTPS ${proxyServerURI};';
        } else {
          return 'DIRECT';
        }
      }`
  }

  async removeProxy () {
    await Browser.proxy.settings.clear({})
    console.warn('Proxy settings removed.')
  }

  async alive () {
    const { proxyIsAlive } =
      await Browser.storage.local.get({ proxyIsAlive: true })

    return proxyIsAlive
  }

  async ping () {
    const { proxyPingURI } = await Browser.storage.local.get('proxyPingURI')

    fetch(`http://${proxyPingURI}`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        type: 'ping',
      }),
    }).catch(() => {
      // We don't care about the result.
      console.log(`Pinged ${proxyPingURI}!`)
    })
  }

  async isEnabled () {
    const { useProxy } = await Browser.storage.local.get({ useProxy: true })

    return useProxy
  }

  async enableProxy () {
    console.log('Proxying enabled.')
    await Browser.storage.local.set({ useProxy: true, proxyIsAlive: true })
  }

  async disableProxy () {
    console.warn('Proxying disabled.')
    await Browser.storage.local.set({ useProxy: false })
  }

  async controlledByOtherExtensions () {
    const { levelOfControl } = await Browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_other_extensions'
  }

  async controlledByThisExtension () {
    const { levelOfControl } = await Browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_this_extension'
  }

  async takeControl () {
    const self = await Browser.management.getSelf()
    const extensions = await Browser.management.getAll()

    for (const { id, name, permissions } of extensions) {
      if (permissions.includes('proxy') && name !== self.name) {
        console.warn(`Disabling ${name}...`)
        await Browser.management.setEnabled(id, false)
      }
    }
  }

  async removeBadProxies () {
    await Browser.storage.local.set({ badProxies: [] })
  }

  async getBadProxies () {
    const { badProxies } =
      await Browser.storage.local.get({ badProxies: [] })

    return badProxies
  }
}

export default new ProxyManager()
