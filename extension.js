const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { Gio, UPowerGlib:UPower } = imports.gi;

let settings;

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
        switch (proxy.State) {
            // State 1,4,5. FULLY_CHARGED for when the battery is completely
            // charged and the charger still plugged in
            case UPower.DeviceState.CHARGING ||
                    UPower.DeviceState.PENDING_CHARGE ||  
                    UPower.DeviceState.FULLY_CHARGED :
                switchProfile(ACDefault);
                break;
            // State 2,6
            case UPower.DeviceState.DISCHARGING ||
                    UPower.DeviceState.PENDING_DISCHARGE :
                if(proxy.Percentage >= batteryThreshold)
                    switchProfile(batteryDefault);
                else
                    switchProfile("power-saver");
                break;
            // State 0=UNKNOWN, 3=EMPTY, 7=LAST
            default:
                switchProfile("balanced");
                break;
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
    switchProfile("balanced");
}
