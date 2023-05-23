const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { Gio, GLib, UPowerGlib:UPower } = imports.gi;

let settings, client, device;

// Checks for changes in settings, must be disconnected in disable
let batteryPercentageWatcher, batteryThresholdWatcher;
let ACDefaultWatcher, batteryDefaultWatcher, platformProfileWatcher
let profileRestoreTimerId;

let batteryThreshold, ACDefault, batteryDefault;

const profileRestoreTimeout = 5000;

const switchProfile = (profile) => {
    try {
        Gio.DBus.system.call(
            'net.hadess.PowerProfiles',
            '/net/hadess/PowerProfiles',
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
    getBattery((proxy) => {
        let nextProfile = "balanced";
            
        if (
            proxy.State === UPower.DeviceState.UNKNOWN ||
            client.on_battery === undefined ||
            device.percentage === undefined
        ) {
            nextProfile = "balanced";
        } else if(
            client.on_battery || 
            device.state === UPower.DeviceState.PENDING_DISCHARGE ||
            device.state === UPower.DeviceState.DISCHARGING
        ) {
            nextProfile = device.percentage >= batteryThreshold ? batteryDefault : "power-saver"
        }
        else {
            nextProfile = ACDefault;
        }

        switchProfile(nextProfile);
    });
}

const getBattery = (callback) => {
    if (Main.panel.statusArea.quickSettings) {
        let system = Main.panel.statusArea.quickSettings._system;
        if (system._systemItem._powerToggle) {
            callback(system._systemItem._powerToggle._proxy, system);
        }
    } else {
        let menu = Main.panel.statusArea.aggregateMenu;
        if (menu && menu._power) {
            callback(menu._power._proxy, menu._power);
        }
    }
}

const getDefaults = () => {
    ACDefault = settings.get_string("ac");
    batteryDefault = settings.get_string("bat");
    batteryThreshold = settings.get_int("threshold");
}

function init() {}

function enable() {

    client = UPower.Client.new();
    device = client.get_display_device();

    settings = ExtensionUtils.getSettings(
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
    
    getBattery((proxy) => {
        batteryThresholdWatcher = proxy.connect(
            "g-properties-changed",
            checkProfile
        );
    });

    platformProfileWatcher = Gio.DBus.system.signal_subscribe(
        'net.hadess.PowerProfiles',
        'org.freedesktop.DBus.Properties',
        'PropertiesChanged',
        '/net/hadess/PowerProfiles',
        null,
        Gio.DBusSignalFlags.NONE,
        (connection, sender, path, iface, signal, params) => {
            const isOnPowerSupply = device?.power_supply ||
                device.state !== UPower.DeviceState.PENDING_DISCHARGE ||
                device.state !== UPower.DeviceState.DISCHARGING;

            if (isOnPowerSupply) {
                try {
                    const reason = params.get_child_value(1)?.deep_unpack()?.PerformanceDegraded?.unpack();
                    if (reason === 'lap-detected') {
                        if (profileRestoreTimerId) {
                            GLib.source_remove(profileRestoreTimerId);
                        }
                        profileRestoreTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, profileRestoreTimeout, () => {
                            checkProfile();
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                }
                catch (e) {
                    logError(e)
                }
            }
        }
    );

    checkProfile();
}

function disable() {
    settings.disconnect(batteryPercentageWatcher);
    settings.disconnect(ACDefaultWatcher);
    settings.disconnect(batteryDefaultWatcher);
    getBattery((proxy) => {
        proxy.disconnect(batteryThresholdWatcher);
    });

    try {
        // https://gjs.guide/guides/gio/dbus.html#direct-calls
        Gio.DBus.system.singal_unsubscribe(platformProfileWatcher);
    }
    catch (e) {
        logError(e);
    }
    if (profileRestoreTimerId) {
        GLib.source_remove(profileRestoreTimerId);
    }
    settings = null;
    client = null;
    device = null;
    switchProfile("balanced");
}

