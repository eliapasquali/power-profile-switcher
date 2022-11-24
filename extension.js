const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const UPower = imports.gi.UPowerGlib;
const Gio = imports.gi.Gio;

let batteryWatching, settingsWatching, settings, disabled;

function switchProfile(profile) {
    try {
        // The process starts running immediately after this function is called. Any
        // error thrown here will be a result of the process failing to start, not
        // the success or failure of the process itself.
        let proc = Gio.Subprocess.new(
            // The program and command options are passed as a list of arguments
            ["powerprofilesctl", "set", profile],

            // The flags control what I/O pipes are opened and how they are directed
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        // Once the process has started, you can end it with `force_exit()`
        //proc.force_exit();
    } catch (e) {
        logError(e);
    }
}

function update() {
    let chosenpercentage = settings.get_int("chosenpercentage");
    getBattery((proxy) => {
        let isDischarging = proxy.State === UPower.DeviceState.DISCHARGING;
        if (!isDischarging) {
            switchProfile("performance");
        } else if (proxy.Percentage >= chosenpercentage && isDischarging) {
            switchProfile("balanced");
        } else if (proxy.Percentage < chosenpercentage && isDischarging) {
            switchProfile("power-saver");
        }
    });
}

function getBattery(callback) {
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

function init() {
    disabled = true;
}

function enable() {
    if (disabled) {
        disabled = false;
        settings = ExtensionUtils.getSettings(
            "ennioitaliano.power-profile-switcher"
        );
        settingsWatching = settings.connect(
            "changed::chosenpercentage",
            update
        );
        getBattery((proxy) => {
            batteryWatching = proxy.connect("g-properties-changed", update);
        });
        update();
    }
}

function disable() {
    if (Main.sessionMode.currentMode !== "unlock-dialog") {
        disabled = true;
        if (settings) settings.disconnect(settingsWatching);
        getBattery((proxy) => {
            proxy.disconnect(batteryWatching);
        });
        switchProfile();
    }
}
