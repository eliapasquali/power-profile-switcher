const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { Gio, UPowerGlib:UPower } = imports.gi;

const Settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.power-profile-switcher");

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
        let isDischarging = proxy.State === UPower.DeviceState.DISCHARGING;
        if(!isDischarging) {
            switchProfile(ACDefault);
        } else {
            if(proxy.Percentage >= batteryThreshold)
                switchProfile(batteryDefault);
            else
                switchProfile("power-saver");
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
    ACDefault = Settings.get_string("ac");
    batteryDefault = Settings.get_string("bat");
    batteryThreshold = Settings.get_int("threshold");
}

function init() {}

function enable() {
    batteryPercentageWatcher = Settings.connect(
        "changed::threshold",
        checkProfile
    );
    
    ACDefaultWatcher = Settings.connect(
        "changed::ac",
        checkProfile
    );

    batteryDefaultWatcher = Settings.connect(
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
    Settings.disconnect(batteryPercentageWatcher);
    Settings.disconnect(ACDefaultWatcher);
    Settings.disconnect(batteryDefaultWatcher);
    getBattery((proxy) => {
        proxy.disconnect(batteryThresholdWatcher);
    });
    switchProfile("balanced");
}
