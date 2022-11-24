const ExtensionUtils = imports.misc.extensionUtils;
const Gettext = imports.gettext;
const Gtk = imports.gi.Gtk;

let _ = Gettext.domain("power-profile-switcher").gettext;

function init() {
    ExtensionUtils.initTranslations("power-profile-switcher");
}

function buildPrefsWidget() {
    let settings = ExtensionUtils.getSettings("ennioitaliano.power-profile-switcher");

    let grid = new Gtk.Grid({
        margin_top: 24,
        margin_bottom: 24,
        margin_start: 24,
        margin_end: 24,
        column_spacing: 24,
        row_spacing: 12,
        halign: Gtk.Align.CENTER,
    });

    let label = new Gtk.Label({
        label: _("Switch between balanced and battery saver when the battery drops under the above percentage"),
        halign: Gtk.Align.START,
    });
    grid.attach(label, 0, 0, 1, 1);

    let field = new Gtk.SpinButton();
    field.set_range(0, 100);
    field.set_sensitive(true);
    field.set_increments(1, 10);
    grid.attach(field, 1, 0, 1, 1);

    field.set_value(settings.get_int("chosenpercentage"));
    field.connect("value-changed", (widget) => {
        settings.set_int("chosenpercentage", widget.get_value_as_int());
    });
    settings.connect("changed::chosenpercentage", () => {
        field.set_value(settings.get_int("chosenpercentage"));
    });
    return grid;
}
