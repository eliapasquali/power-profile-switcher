/*
 * Copyright 2013 Andrey Sitnik <andrey@sitnik.ru>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const Lang   = imports.lang;
const Main   = imports.ui.main;
const Status = imports.ui.status;

// Main extension API
function init() {
};
function enable() {
    battery.bind().update();
};
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

    // Check current battery state and hide or show icon
    update: function () {
        this.getDevice(function (device) {
            if ( device.state == Status.power.UPDeviceState.FULLY_CHARGED ) {
                this.hide();
            } else {
                this.show();
            }
        });
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

                    if ( device.type == Status.power.UPDeviceType.BATTERY ) {
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
        let batteryArea = Main.panel.statusArea.battery;
        if ( batteryArea ) {
            callback.call(this, batteryArea._proxy, batteryArea.actor);
        }
    }
};
