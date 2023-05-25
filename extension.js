const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { Gio, GLib, UPowerGlib:UPower } = imports.gi;

let settings, client, device;

// Checks for changes in settings, must be disconnected in disable
let batteryPercentageWatcher, batteryThresholdWatcher;
let ACDefaultWatcher, batteryDefaultWatcher, platformProfileWatcher

let batteryThreshold, ACDefault, batteryDefault, activeProfile;

let _proxy, _cancellable;

const BUS_NAME = 'org.freedesktop.UPower';
const OBJECT_PATH = '/org/freedesktop/UPower/devices/DisplayDevice';

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

const switchProfile = (profile) => {
    if (profile === activeProfile) {
        return;
    }
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

    let nextProfile = "balanced";
        
    if (
        _proxy.State === UPower.DeviceState.UNKNOWN ||
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

    _cancellable = new Gio.Cancellable();
    _proxy = new PowerManagerProxy(Gio.DBus.system, BUS_NAME, OBJECT_PATH,
        (proxy, error) => {
            if (error) {
                logError(error.message);
                return;
            }
            batteryThresholdWatcher = _proxy.connect('g-properties-changed', checkProfile);
        }, _cancellable);

    platformProfileWatcher = Gio.DBus.system.signal_subscribe(
        'net.hadess.PowerProfiles',
        'org.freedesktop.DBus.Properties',
        'PropertiesChanged',
        '/net/hadess/PowerProfiles',
        null,
        Gio.DBusSignalFlags.NONE,
        (connection, sender, path, iface, signal, params) => {
            const payload = params.get_child_value(1)?.deep_unpack();
            
            if (payload?.ActiveProfile) {
                activeProfile = payload?.ActiveProfile?.unpack();
            }
            
            const isOnPowerSupply = device?.power_supply ||
                device.state !== UPower.DeviceState.PENDING_DISCHARGE ||
                device.state !== UPower.DeviceState.DISCHARGING;

            if (isOnPowerSupply && payload?.PerformanceDegraded) {
                try {
                    const reason = payload?.PerformanceDegraded?.unpack();
                    if (reason === 'lap-detected') {
                        checkProfile();
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

    _proxy.disconnect(batteryThresholdWatcher);
    _cancellable.cancel();

    try {
        // https://gjs.guide/guides/gio/dbus.html#direct-calls
        Gio.DBus.system.singal_unsubscribe(platformProfileWatcher);
    }
    catch (e) {
        logError(e);
    }
    settings = null;
    client = null;
    device = null;
    switchProfile("balanced");
}

