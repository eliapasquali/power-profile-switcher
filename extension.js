import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import UPower from 'gi://UPowerGlib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {loadInterfaceXML} from 'resource:///org/gnome/shell/misc/fileUtils.js';

let settings, client, device;

// Checks for changes in settings, must be disconnected in disable
let batteryPercentageWatcher;
let ACDefaultWatcher, batteryDefaultWatcher;

let batteryThreshold, ACDefault, batteryDefault, activeProfile, perfDebounceTimerId;

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

// power-profiles-daemon registers both bus names; prefer the newer freedesktop one
// and fall back to the legacy net.hadess.PowerProfiles for older systems.
const POWER_PROFILES_BUS_NAME = 'net.hadess.PowerProfiles';
const POWER_PROFILES_OBJECT_PATH = '/net/hadess/PowerProfiles';

// GNOME 47+ ships the interface XML under the org.freedesktop.UPower.PowerProfiles key;
// older versions used net.hadess.PowerProfiles. Try both and fall back to an inline definition.
let PowerProfilesIface = loadInterfaceXML('org.freedesktop.UPower.PowerProfiles') ||
                         loadInterfaceXML('net.hadess.PowerProfiles') ||
                         `<node>
                           <interface name="net.hadess.PowerProfiles">
                             <property name="ActiveProfile" type="s" access="readwrite"/>
                             <property name="PerformanceDegraded" type="s" access="read"/>
                             <property name="Profiles" type="aa{sv}" access="read"/>
                             <property name="Actions" type="as" access="read"/>
                           </interface>
                         </node>`;

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
                    console.error(`Power Profile Switcher: failed to switch profile: ${e.message}`);
                }
            }
        );
    } catch (e) {
        console.error(`Power Profile Switcher: failed to switch profile: ${e.message}`);
    }
}

const checkProfile = () => {
    getDefaults();

    let nextProfile = "balanced";

    // Determine if the device is on battery (discharging).
    // On desktop PCs, UPower may report state UNKNOWN or FULLY_CHARGED even on AC.
    // We consider a device to be on battery only when it is explicitly discharging
    // or pending discharge.
    const onBattery =
        device?.state === UPower.DeviceState.DISCHARGING ||
        device?.state === UPower.DeviceState.PENDING_DISCHARGE;

    if (onBattery) {
        const percentage = device?.percentage ?? 100;
        nextProfile = percentage >= batteryThreshold ? batteryDefault : 'power-saver';
    } else {
        // On AC, fully charged, or unknown state (e.g. desktop without battery)
        nextProfile = ACDefault;
    }

    switchProfile(nextProfile);
}

const getDefaults = () => {
    ACDefault = settings.get_string("ac");
    batteryDefault = settings.get_string("bat");
    batteryThreshold = settings.get_int("threshold");
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

        powerManagerCancellable = new Gio.Cancellable();
        powerManagerProxy = new PowerManagerProxy(
            Gio.DBus.system,
            UPOWER_BUS_NAME,
            UPOWER_OBJECT_PATH,
            (proxy, error) => {
                if (error) {
                    console.error(`Power Profile Switcher: UPower proxy error: ${error.message}`);
                    return;
                }
                batteryThresholdWatcher = powerManagerProxy.connect('g-properties-changed', checkProfile);
                checkProfile();
            },
            powerManagerCancellable
        );

        powerProfilesCancellable = new Gio.Cancellable();
        powerProfilesProxy = new PowerProfilesProxy(
            Gio.DBus.system,
            POWER_PROFILES_BUS_NAME,
            POWER_PROFILES_OBJECT_PATH,
            (proxy, error) => {
                if (error) {
                    console.error(`Power Profile Switcher: PowerProfiles proxy error: ${error.message}`);
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

                        const onBattery =
                            device?.state === UPower.DeviceState.DISCHARGING ||
                            device?.state === UPower.DeviceState.PENDING_DISCHARGE;

                        if (!onBattery && payload?.PerformanceDegraded) {
                            try {
                                const reason = payload?.PerformanceDegraded?.unpack();

                                if (reason === 'lap-detected') {
                                    perfDebounceTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                                        checkProfile();
                                        perfDebounceTimerId = null;
                                        return GLib.SOURCE_REMOVE;
                                    });
                                } else if (reason) {
                                    console.log(`Power Profile Switcher: ActiveProfile=${activeProfile}, PerformanceDegraded=${reason}`);
                                }
                            } catch (e) {
                                console.error(`Power Profile Switcher: error handling PerformanceDegraded: ${e.message}`);
                            }
                        }
                    });
                }
            },
            powerProfilesCancellable
        );
    }

    disable() {
        if (batteryPercentageWatcher) {
            settings.disconnect(batteryPercentageWatcher);
            batteryPercentageWatcher = null;
        }
        if (ACDefaultWatcher) {
            settings.disconnect(ACDefaultWatcher);
            ACDefaultWatcher = null;
        }
        if (batteryDefaultWatcher) {
            settings.disconnect(batteryDefaultWatcher);
            batteryDefaultWatcher = null;
        }

        if (batteryThresholdWatcher && powerManagerProxy) {
            powerManagerProxy.disconnect(batteryThresholdWatcher);
            batteryThresholdWatcher = null;
        }
        if (powerManagerCancellable) {
            powerManagerCancellable.cancel();
            powerManagerCancellable = null;
        }

        if (powerProfileWatcher && powerProfilesProxy) {
            powerProfilesProxy.disconnect(powerProfileWatcher);
            powerProfileWatcher = null;
        }
        if (powerProfilesCancellable) {
            powerProfilesCancellable.cancel();
            powerProfilesCancellable = null;
        }

        if (perfDebounceTimerId) {
            GLib.source_remove(perfDebounceTimerId);
            perfDebounceTimerId = null;
        }

        settings = null;
        client = null;
        device = null;
        activeProfile = null;
        powerManagerProxy = null;
        powerProfilesProxy = null;
    }
}
