const {Adw, GLib, Gtk} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;

function init() {}

function fillPreferencesWindow(window) {

    let settings = ExtensionUtils.getSettings(
        "org.gnome.shell.extensions.power-profile-switcher"
    );
    window._prefsSettings = settings;

    const prefsPage = new Adw.PreferencesPage({
        name: 'general',
        title: 'General',
        icon_name: 'dialog-information-symbolic',
    });
    window.add(prefsPage);
    
    const defaultsGroup = new Adw.PreferencesGroup({
        title: 'Default profiles',
        description: 'Configure the default profiles',
    });
    prefsPage.add(defaultsGroup);

    // On AC default
    const ac_defaults_row = new Adw.ActionRow({
        title: 'On AC',
        subtitle: 'Select the default profile when connected to AC'
    })

    const ac_defaults_combo = new Gtk.ComboBoxText();
    ac_defaults_combo.append("performance", "Performance");
    ac_defaults_combo.append("balanced", "Balanced");
    ac_defaults_combo.append("power-saver", "Power Saving");
    ac_defaults_combo.set_active_id(settings.get_string("ac"));

    ac_defaults_row.add_suffix(ac_defaults_combo);

    defaultsGroup.add(ac_defaults_row);

    // On battery defaults
    const battery_default_row = new Adw.ActionRow({
        title: 'On battery',
        subtitle: 'Select the default profile when running on battery'
    })

    const battery_default_combo = new Gtk.ComboBoxText();
    battery_default_combo.append("performance", "Performance");
    battery_default_combo.append("balanced", "Balanced");
    battery_default_combo.append("power-saver", "Power Saving");
    battery_default_combo.set_active_id(settings.get_string("bat"));

    battery_default_row.add_suffix(battery_default_combo);

    defaultsGroup.add(battery_default_row);

    // Power saving configuration, like activation threshold
    const powerSavingGroup = new Adw.PreferencesGroup({
        title: 'Power saving configuration',
        description: `Configure the power saving options`,
    });
    prefsPage.add(powerSavingGroup);

    // Set the threshold
    const threshold_default_row = new Adw.ActionRow({
        title: 'Power saving threshold',
        subtitle: 'Switch to power saving profile when the battery level drops below:'
    })

    const battery_threshold_spin = new Gtk.SpinButton();
    battery_threshold_spin.set_range(0, 100);
    battery_threshold_spin.set_sensitive(true);
    battery_threshold_spin.set_increments(1, 10);

    battery_threshold_spin.set_value(settings.get_int("threshold"));

    threshold_default_row.add_suffix(battery_threshold_spin);

    powerSavingGroup.add(threshold_default_row);


    // Connect components and save settings
    battery_threshold_spin.connect("value-changed", (battery_threshold_spin) => {
        settings.set_int("threshold", battery_threshold_spin.get_value_as_int());
    });

    ac_defaults_combo.connect("changed", (ac_defaults_combo) => {
        settings.set_string("ac", ac_defaults_combo.get_active_id());
    });

    battery_default_combo.connect("changed", (battery_default_combo) => {
        settings.set_string("bat", battery_default_combo.get_active_id());
    });

}