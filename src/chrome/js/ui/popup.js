
const elById = (id) => document.getElementById(id)

const statusImageEl = elById('statusImage')
const popupFooterEl = elById('popupFooter')
const lastSyncDateEl = elById('lastSyncDate')
const oriMatchFoundEl = elById('oriMatchFound')
const registryMatchFoundEl = elById('matchFound')
const vpnAdvertisingEl = elById('vpnAdvertising')
const extensionStatusEl = elById('extensionStatus')
const extensionStatusLabelEl = elById('extensionStatusLabel')
const cooperationAcceptedEl = elById('cooperationAccepted')
const cooperationRejectedEl = elById('cooperationRejected')
const currentDomainEl = elById('currentDomain')
const extensionNameEl = elById('extensionName')
const redIcon = chrome.extension.getURL('images/red_icon.png')

chrome.runtime.getBackgroundPage(async (bgWindow) => {
  const { settings, proxies, registry, shortcuts, Database } = bgWindow.censortracker

  extensionNameEl.innerText = settings.getTitle()

  const updateExtensionStatusLabel = () => {
    let labelText = 'Расширение выключено'
    let tooltipStatus = 'выключен'
    const extName = settings.getName()

    if (extensionStatusEl.checked) {
      labelText = 'Расширение включено'
      tooltipStatus = 'включен'
    }
    extensionStatusLabelEl.innerText = labelText
    extensionStatusLabelEl.setAttribute('title', `${extName} ${tooltipStatus}`)
  }

  document.addEventListener('click', (event) => {
    if (event.target.matches(`#${extensionStatusEl.id}`)) {
      updateExtensionStatusLabel()
      if (extensionStatusEl.checked) {
        popupFooterEl.hidden = false
        shortcuts.enableExtension()
        proxies.setProxy()
      } else {
        popupFooterEl.hidden = true
        proxies.removeProxy()
        shortcuts.disableExtension()
      }
    }
  })

  const config = await Database.get(['enableExtension'])

  if (config.enableExtension) {
    extensionStatusEl.checked = config.enableExtension
  }

  chrome.tabs.query(
    {
      active: true,
      lastFocusedWindow: true,
    },
    async (tabs) => {
      const activeTab = tabs[0]
      const activeTabUrl = activeTab.url

      if (activeTabUrl.startsWith('chrome-extension://')) {
        popupFooterEl.hidden = true
        return
      }

      const urlObject = new URL(activeTabUrl)
      const hostname = shortcuts.cleanHostname(urlObject.hostname)

      if (shortcuts.validURL(hostname)) {
        currentDomainEl.innerText = hostname.replace('www.', '')
      }

      updateExtensionStatusLabel()

      if (config.enableExtension) {
        registry.getLastSyncTimestamp().then((timestamp) => {
          lastSyncDateEl.innerText = timestamp.replace(/\//g, '.')
        })

        registry.checkDomains(hostname)
          .then((_data) => {
            registryMatchFoundEl.innerHTML = shortcuts.createSearchLink(hostname)
            vpnAdvertisingEl.hidden = false
            statusImageEl.setAttribute('src', redIcon)
          })

        registry.checkDistributors(hostname)
          .then((cooperationRefused) => {
            oriMatchFoundEl.innerHTML = shortcuts.createSearchLink(hostname)
            vpnAdvertisingEl.hidden = true
            statusImageEl.setAttribute('src', redIcon)

            if (cooperationRefused) {
              cooperationRejectedEl.hidden = false
            } else {
              cooperationAcceptedEl.hidden = false
            }
          })
      } else {
        popupFooterEl.hidden = true
      }
    },
  )

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, 165)
})
