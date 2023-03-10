const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { Gio, UPowerGlib:UPower } = imports.gi;

let settings, client, device;

// Checks for changes in settings, must be disconnected in disable
let batteryPercentageWatcher, batteryThresholdWatcher;
let ACDefaultWatcher, batteryDefaultWatcher;

let batteryThreshold, ACDefault, batteryDefault;

const switchProfile = (profile) => {
    try {
        Gio.Subprocess.new(
            ["powerprofilesctl", "set", profile],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
    } catch (e) {
        logError(e);
    }
}

const checkProfile = () => {
    getDefaults();
    getBattery((proxy) => {
        if(proxy.State === UPower.DeviceState.UNKNOWN ||
            client.on_battery === undefined ||
            device.percentage === undefined )
                switchProfile("balanced");
            
              
        if(client.on_battery || 
            device.state === UPower.DeviceState.PENDING_DISCHARGE ||
            device.state === UPower.DeviceState.DISCHARGING ){
            if(device.percentage >= batteryThreshold) {
                switchProfile(batteryDefault);
            } else {
                switchProfile("power-saver");
            }
        } else {
            switchProfile(ACDefault);
        }
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

    checkProfile();
}

function disable() {
    settings.disconnect(batteryPercentageWatcher);
    settings.disconnect(ACDefaultWatcher);
    settings.disconnect(batteryDefaultWatcher);
    getBattery((proxy) => {
        proxy.disconnect(batteryThresholdWatcher);
    });
    settings = null;
    client = null;
    device = null;
    switchProfile("balanced");
}
