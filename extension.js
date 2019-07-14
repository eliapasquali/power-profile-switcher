const UPower = imports.ui.status.power.UPower
const Main = imports.ui.main

let watching

function bind () {
  getBattery(proxy => {
    watching = proxy.connect('g-properties-changed', update)
  })
}

function unbind () {
  getBattery(proxy => {
    proxy.disconnect(watching)
  })
}

function show () {
  getBattery((proxy, icon) => {
    icon.show()
  })
}

function hide () {
  getBattery((proxy, icon) => {
    icon.hide()
  })
}

function update () {
  getBattery(proxy => {
    let isBattery = proxy.Type === UPower.DeviceKind.BATTERY
    let notDischarging = proxy.State !== UPower.DeviceState.DISCHARGING
    if (isBattery && notDischarging && proxy.Percentage === 100) {
      hide()
    } else {
      show()
    }
  })
}

function getBattery (callback) {
  let menu = Main.panel.statusArea.aggregateMenu
  if (menu && menu._power) {
    callback(menu._power._proxy, menu._power.indicators)
  }
}

/* exported init, enable, disable */

function init () { }

function enable () {
  bind()
  update()
}

function disable () {
  unbind()
  show()
}
