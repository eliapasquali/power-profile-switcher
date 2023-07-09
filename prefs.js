const { Adw, GLib, GObject, Gio } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const PROFILE_CHOICES = [
    'performance',
    'balanced',
    'power-saver'
];

function bindAdwComboRow(comboRow, settings, key, map_) {
    const initValue = settings.get_string(key);
    comboRow.selected = map_.indexOf(initValue);

    settings.connect(
        `changed::${key}`, () => {
            const idx = map_.indexOf(settings.get_string(key));
            comboRow.selected = idx;
        }
    );
    comboRow.connect('notify::selected', () => {
        const value = map_[comboRow.selected];
        settings.set_string(key, value);
    });
}


var General = GObject.registerClass({
    GTypeName: 'GeneralPreferences',
    Template: `file://${GLib.build_filenamev([Me.path, 'ui', 'general.ui'])}`,
    InternalChildren: [
        'ac_profile',
        'bat_profile',
        'threshold',
    ],
}, class General extends Adw.PreferencesPage {
    constructor(settings) {
        super({});

        bindAdwComboRow(this._ac_profile, settings, 'ac', PROFILE_CHOICES);
        bindAdwComboRow(this._bat_profile, settings, 'bat', PROFILE_CHOICES);
        settings.bind(
            'threshold', 
            this._threshold, 
            'value', 
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});


function init() {}


function fillPreferencesWindow(window) {

    const settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.power-profile-switcher");

    window.add(new General(settings));
    
}
