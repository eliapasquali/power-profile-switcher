const UPower = imports.ui.status.power.UPower
const Main = imports.ui.main
const Lang = imports.lang

let battery = {
  watching: null,

  bind () {
    this.getBattery(proxy => {
      let update = Lang.bind(this, this.update)
      this.watching = proxy.connect('g-properties-changed', update)
    })
  },

  unbind () {
    this.getBattery(proxy => {
      proxy.disconnect(this.watching)
    })
  },

  show () {
    this.getBattery((proxy, icon) => {
      icon.show()
    })
  },

  hide () {
    this.getBattery((proxy, icon) => {
      icon.hide()
    })
  },

  update () {
    this.getBattery(p => {
      if (p.Type === UPower.DeviceKind.BATTERY && p.Percentage === 100) {
        this.hide()
      } else {
        this.show()
      }
    })
  },

  getBattery (callback) {
    let menu = Main.panel.statusArea.aggregateMenu
    if (menu && menu._power) {
      callback(menu._power._proxy, menu._power.indicators)
    }
  }
}

/* exported init, enable, disable */

function init () { }

function enable () {
  battery.bind().update()
}

function disable () {
  battery.unbind().show()
}
