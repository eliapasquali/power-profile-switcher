const Lang   = imports.lang;
const Main   = imports.ui.main;
const UPower = imports.ui.status.power.UPower;

// Main extension API
function init() { };

//Enable
function enable() {
    battery.bind().update();
};

//Disable
function disable() {
    battery.unbind().show();
};

// Namespace for extension logic
let battery = {
    // Watcher ID to disable listening
    watching: null,

    // Start listen to battery status changes
    bind: function () {
        this.getBattery(function (proxy) {
            let update = Lang.bind(this, this.update);
            this.watching = proxy.connect('g-properties-changed', update);
        });
        return this;
    },

    // Stop listen to battery status changes
    unbind: function () {
        this.getBattery(function (proxy) {
            proxy.disconnect(this.watching);
        });
        return this;
    },

    // Show battery icon in status area
    show: function () {
        this.getBattery(function (proxy, icon) {
            icon.show();
        });
        return this;
    },

    // Hide battery icon in status area
    hide: function () {
        this.getBattery(function (proxy, icon) {
            icon.hide();
        });
        return this;
    },

    // Return GNOME Shell version
    shell: function () {
        var parts = imports.misc.config.PACKAGE_VERSION.split('.')
        return parseFloat(parts[0] + '.' + parts[1]);
    },

    // Check current battery state and hide or show icon
    update: function () {
        if ( this.shell() >= 3.12 ) {
            this.getBattery(function (proxy) {
                var batteryPowered = UPower.DeviceKind.BATTERY,
                    fullyCharged = UPower.DeviceState.FULLY_CHARGED;

                if (proxy.State ==  fullyCharged && proxy.Type == batteryPowered) {
                    this.hide();
                } else {
                    this.show();
                }
            });
        } else {
            this.getDevice(function (device) {
                if ( device.state == UPower.DeviceState.FULLY_CHARGED ) {
                    this.hide();
                } else {
                    this.show();
                }
            });
        }

        return this;
    },

    // Execute `callback` on every battery device
    getDevice: function (callback) {
        this.getBattery(function (proxy) {
            proxy.GetDevicesRemote(Lang.bind(this, function(result, error) {
                if ( error ) {
                    return;
                }

                let devices = result[0];
                for ( let i = 0; i < devices.length; i++ ) {
                    let device = {
                        id:      devices[i][0],
                        type:    devices[i][1],
                        icon:    devices[i][2],
                        percent: devices[i][3],
                        state:   devices[i][4],
                        time:    devices[i][5]
                    };

                    if ( device.type == UPower.DeviceKind.BATTERY ) {
                        callback.call(this, device);
                        break;
                    }
                }
            }));
        });
    },

    // Run `callback`, only if battery is avaiable. First argument will be icon,
    // second will be it proxy.
    getBattery: function (callback) {
        let menu = Main.panel.statusArea.aggregateMenu;
        if ( menu && menu._power ) {
            callback.call(this, menu._power._proxy, menu._power.indicators);
        }
    }
};
