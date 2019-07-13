const UPower = imports.ui.status.power.UPower
const Main = imports.ui.main
const Lang = imports.lang

/* exported init, enable, disable */

// Main extension API
function init () { }

// Enable
function enable () {
  battery.bind().update()
}

// Disable
function disable () {
  battery.unbind().show()
}

// Namespace for extension logic
let battery = {
  // Watcher ID to disable listening
  watching: null,

  // Start listen to battery status changes
  bind () {
    this.getBattery(proxy => {
      let update = Lang.bind(this, this.update)
      this.watching = proxy.connect('g-properties-changed', update)
    })
  },

  // Stop listen to battery status changes
  unbind () {
    this.getBattery(proxy => {
      proxy.disconnect(this.watching)
    })
  },

  // Show battery icon in status area
  show () {
    this.getBattery((proxy, icon) => {
      icon.show()
    })
  },

  // Hide battery icon in status area
  hide () {
    this.getBattery((proxy, icon) => {
      icon.hide()
    })
  },

  // Check current battery state and hide or show icon
  update () {
    this.getBattery(proxy => {
      let batteryPowered = UPower.DeviceKind.BATTERY
      let fullyCharged = UPower.DeviceState.FULLY_CHARGED

      if (proxy.State === fullyCharged && proxy.Type === batteryPowered) {
        this.hide()
      } else {
        this.show()
      }
    })
  },

  // Run `callback`, only if battery is avaiable. First argument will be icon,
  // second will be it proxy.
  getBattery (callback) {
    let menu = Main.panel.statusArea.aggregateMenu
    if (menu && menu._power) {
      callback(menu._power._proxy, menu._power.indicators)
    }
  }
}
