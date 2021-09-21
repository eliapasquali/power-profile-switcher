const ExtensionUtils = imports.misc.extensionUtils
const UPower = imports.ui.status.power.UPower
const Main = imports.ui.main

let batteryWatching, settingsWatching, settings, disabled

function show() {
  getBattery((proxy, icon) => {
    icon.show()
  })
}

function hide() {
  getBattery((proxy, icon) => {
    icon.hide()
  })
}

function update() {
  let hideOn = settings.get_int('hide-on')
  getBattery(proxy => {
    let isDischarging = proxy.State === UPower.DeviceState.DISCHARGING
    let isFullyCharged = proxy.State === UPower.DeviceState.FULLY_CHARGED
    if (proxy.Type !== UPower.DeviceKind.BATTERY) {
      show()
    } else if (isFullyCharged) {
      hide()
    } else if (proxy.Percentage >= hideOn && !isDischarging) {
      hide()
    } else {
      show()
    }
  })
}

function getBattery(callback) {
  let menu = Main.panel.statusArea.aggregateMenu
  if (menu && menu._power) {
    callback(menu._power._proxy, menu._power)
  }
}

function enable() {
  if (disabled) {
    disabled = false
    settings = ExtensionUtils.getSettings('ru.sitnik.autohide-battery')
    settingsWatching = settings.connect('changed::hide-on', update)
    getBattery(proxy => {
      batteryWatching = proxy.connect('g-properties-changed', update)
    })
    update()
  }
}

function disable() {
  if(Main.sessionMode.currentMode != 'unlock-dialog') {
    disabled = true
    if (settings) settings.disconnect(settingsWatching)
    getBattery(proxy => {
      proxy.disconnect(batteryWatching)
    })
    show()
  }
}
