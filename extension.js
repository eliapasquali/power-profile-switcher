import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import UPower from 'gi://UPowerGlib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as FileUtils from 'resource:///org/gnome/shell/misc/fileUtils.js';

let settings, client, device;

// Checks for changes in settings, must be disconnected in disable
let batteryPercentageWatcher;
let ACDefaultWatcher, batteryDefaultWatcher, lockedDefaultWatcher;

let batteryThreshold, ACDefault, batteryDefault, lockedDefault, activeProfile, perfDebounceTimerId;

let powerManagerProxy, powerManagerCancellable, batteryThresholdWatcher;
let powerProfilesProxy, powerProfilesCancellable, powerProfileWatcher;

const UPOWER_BUS_NAME = 'org.freedesktop.UPower';
const UPOWER_OBJECT_PATH = '/org/freedesktop/UPower/devices/DisplayDevice';

const DisplayDeviceInterface = '<node> \
<interface name="org.freedesktop.UPower.Device"> \
  <property name="Type" type="u" access="read"/> \
  <property name="State" type="u" access="read"/> \
  <property name="Percentage" type="d" access="read"/> \
  <property name="TimeToEmpty" type="x" access="read"/> \
  <property name="TimeToFull" type="x" access="read"/> \
  <property name="IsPresent" type="b" access="read"/> \
  <property name="IconName" type="s" access="read"/> \
</interface> \
</node>';

const PowerManagerProxy = Gio.DBusProxy.makeProxyWrapper(DisplayDeviceInterface);

const POWER_PROFILES_BUS_NAME = 'net.hadess.PowerProfiles';
const POWER_PROFILES_OBJECT_PATH = '/net/hadess/PowerProfiles';

const PowerProfilesIface = FileUtils.loadInterfaceXML('net.hadess.PowerProfiles');
const PowerProfilesProxy = Gio.DBusProxy.makeProxyWrapper(PowerProfilesIface);


const switchProfile = (profile) => {
    if (profile === activeProfile) {
        return;
    }
    try {
        Gio.DBus.system.call(
            POWER_PROFILES_BUS_NAME,
            POWER_PROFILES_OBJECT_PATH,
            'org.freedesktop.DBus.Properties',
            'Set',
            new GLib.Variant('(ssv)', [
                'net.hadess.PowerProfiles',
                'ActiveProfile',
                new GLib.Variant('s', profile)
            ]),
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, res) => {
                try {
                    connection.call_finish(res);
                } catch (e) {
                    logError(e);
                }
            }
        );
    } catch (e) {
        logError(e);
    }
}

const checkProfile = () => {
    getDefaults();

    let nextProfile = "balanced";
        
    if (
        powerManagerProxy.State === UPower.DeviceState.UNKNOWN ||
        client.on_battery === undefined ||
        device.percentage === undefined
    ) {
        nextProfile = "balanced";
    } else if(
        device.state === UPower.DeviceState.PENDING_DISCHARGE ||
        device.state === UPower.DeviceState.DISCHARGING
    ) {
        nextProfile = device.percentage >= batteryThreshold ? batteryDefault : "power-saver"
    }
    else {
        nextProfile = ACDefault;
    }

    switchProfile(nextProfile);
}

const getDefaults = () => {
    ACDefault = settings.get_string("ac");
    batteryDefault = settings.get_string("bat");
    batteryThreshold = settings.get_int("threshold");
    lockedDefault = settings.get_string("locked");
}

export default class PowerProfileSwitcher extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    enable() {
        client = UPower.Client.new();
        device = client.get_display_device();

        settings = this.getSettings(
            "org.gnome.shell.extensions.power-profile-switcher"
        );

        batteryPercentageWatcher = settings.connect(
            "changed::threshold",
            checkProfile
        );
        
        ACDefaultWatcher = settings.connect(
            "changed::ac",
            checkProfile
        );

        batteryDefaultWatcher = settings.connect(
            "changed::bat",
            checkProfile
        );

        lockedDefaultWatcher = settings.connect(
            "changed::locked",
            checkProfile
        );

        powerManagerCancellable = new Gio.Cancellable();
        powerManagerProxy = new PowerManagerProxy(Gio.DBus.system, UPOWER_BUS_NAME, UPOWER_OBJECT_PATH,
            (proxy, error) => {
                if (error) {
                    logError(error.message);
                    return;
                }
                batteryThresholdWatcher = powerManagerProxy.connect('g-properties-changed', checkProfile);
                checkProfile();
            }, powerManagerCancellable);


        powerProfilesCancellable = new Gio.Cancellable();
        powerProfilesProxy = new PowerProfilesProxy(Gio.DBus.system, POWER_PROFILES_BUS_NAME, POWER_PROFILES_OBJECT_PATH,
            (proxy, error) => {
                if (error) {
                    logError(error.message);
                } else {
                    powerProfileWatcher = powerProfilesProxy.connect('g-properties-changed', (p, properties) => {
                        const payload = properties?.deep_unpack();

                        if (payload?.ActiveProfile) {
                            activeProfile = payload?.ActiveProfile?.unpack();
                            if (perfDebounceTimerId) {
                                GLib.source_remove(perfDebounceTimerId);
                                perfDebounceTimerId = null;
                            }
                        }

                        const isOnPowerSupply = device?.power_supply ||
                            device?.state !== UPower.DeviceState.PENDING_DISCHARGE ||
                            device?.state !== UPower.DeviceState.DISCHARGING;

                        if (isOnPowerSupply && payload?.PerformanceDegraded) {
                            try {
                                const reason = payload?.PerformanceDegraded?.unpack();

                                if (reason === 'lap-detected') {
                                    perfDebounceTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                                        checkProfile();
                                        perfDebounceTimerId = null;
                                        return GLib.SOURCE_REMOVE;
                                    });
                                }
                                else if (reason) {
                                    console.log(`ActiveProfile: ${activeProfile}, PerformanceDegraded: ${reason}`);
                                }
                            }
                            catch (e) {
                                logError(e)
                            }
                        }
                    });
                }
            }, powerProfilesCancellable);
    }

    disable() {
        settings.disconnect(batteryPercentageWatcher);
        settings.disconnect(ACDefaultWatcher);
        settings.disconnect(batteryDefaultWatcher);
        settings.disconnect(lockedDefaultWatcher);

        powerManagerProxy.disconnect(batteryThresholdWatcher);
        powerManagerCancellable.cancel();

        powerProfilesProxy.disconnect(powerProfileWatcher);
        powerProfilesCancellable.cancel();

        if (perfDebounceTimerId) {
            GLib.source_remove(perfDebounceTimerId);
            perfDebounceTimerId = null;
        }

        settings = null;
        client = null;
        device = null;
        powerManagerCancellable = null;
        powerProfilesCancellable = null;
        activeProfile = null;
        switchProfile(lockedDefault);
    }
}
